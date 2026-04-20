import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { enforceCompanyRateLimit, RateLimitError } from "@/lib/company-rate-limit";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { logCompanyAudit } from "@/lib/company-security";
import { assertCsFinanceCompanyScope } from "@/lib/company-finance-delegation";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (
      auth.role === "CUSTOMER_SERVICE" &&
      !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY") &&
      !hasCSRole(auth, "MANAGE_COMPANY_FINANCE")
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const nextStatus = String(body?.status || "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const idemKeyHeader = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idemKeyHeader) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }

    const existingRequest = await prisma.deliveryCompanyDepartmentBudgetRequest.findUnique({
      where: { id },
      select: { deliveryCompanyId: true, departmentId: true, amountCoins: true, requestedByAccountId: true },
    });
    if (!existingRequest) {
      return NextResponse.json({ error: "Budget request not found" }, { status: 404 });
    }

    try {
      await assertCsFinanceCompanyScope(auth, existingRequest.deliveryCompanyId);
    } catch (scopeErr: unknown) {
      const m = scopeErr instanceof Error ? scopeErr.message : "Forbidden";
      return NextResponse.json({ error: m }, { status: 403 });
    }

    enforceCompanyRateLimit(
      ["delivery-companies-budget-decision", existingRequest.deliveryCompanyId, auth.superUserId],
      20,
      60_000,
    );

    const endpointKey = "delivery-control/admin/delivery-companies/budget-requests:PATCH";
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ id, nextStatus, decisionNote: body?.decisionNote ?? null }) + "|" + String(existingRequest.deliveryCompanyId))
      .digest("hex");

    const db: any = prisma;
    const existingIdem = await db.deliveryCompanyIdempotencyKey.findFirst({
      where: { deliveryCompanyId: existingRequest.deliveryCompanyId, endpointKey, idempotencyKey: idemKeyHeader },
    });
    if (existingIdem) {
      if (existingIdem.requestHash !== requestHash) {
        return NextResponse.json({ error: "Idempotency key used with a different request body" }, { status: 409 });
      }
      if (existingIdem.responseBody) {
        return NextResponse.json(existingIdem.responseBody);
      }
      return NextResponse.json({ error: "Idempotency request is in progress; please retry" }, { status: 409 });
    }

    const result = await db.$transaction(async (tx: any) => {
      const idemRow = await tx.deliveryCompanyIdempotencyKey.create({
        data: {
          deliveryCompanyId: existingRequest.deliveryCompanyId,
          actorRef: auth.superUserId,
          endpointKey,
          idempotencyKey: idemKeyHeader,
          requestHash,
          responseStatus: 0,
          responseBody: null,
        },
      });

      // Wallet + ledger side effects must only happen once (idempotency is ensured above)
      if (nextStatus === "APPROVED") {
        const company = await tx.deliveryCompany.findUnique({
          where: { id: existingRequest.deliveryCompanyId },
          select: { coinBalance: true, lockedCoins: true },
        });

        const amount = Number(existingRequest.amountCoins ?? 0);
        const available = Number(company?.coinBalance ?? 0) - Number(company?.lockedCoins ?? 0);
        if (amount > available) throw new Error("Insufficient company available balance");

        await tx.deliveryCompanyDepartmentBudgetWallet.upsert({
          where: { departmentId: existingRequest.departmentId },
          create: {
            deliveryCompanyId: existingRequest.deliveryCompanyId,
            departmentId: existingRequest.departmentId,
            availableCoins: amount,
          },
          update: { availableCoins: { increment: amount } },
        });

        const newCompanyBalance = Number(company!.coinBalance) - amount;
        await tx.deliveryCompany.update({
          where: { id: existingRequest.deliveryCompanyId },
          data: { coinBalance: newCompanyBalance },
        });

        await tx.deliveryCompanyTransaction.create({
          data: {
            deliveryCompanyId: existingRequest.deliveryCompanyId,
            type: "DEPARTMENT_BUDGET_ALLOC",
            amount: -amount,
            balanceAfter: newCompanyBalance,
            description: `Manual budget approval for department ${existingRequest.departmentId}`,
          },
        });
      }

      const updated = await tx.deliveryCompanyDepartmentBudgetRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          decisionNote: body?.decisionNote || null,
          decidedBy: auth.superUserId,
          decidedAt: new Date(),
        },
      });

      // Serialize: strip Dates/Decimals into JSON-friendly values
      const safeUpdated = {
        ...updated,
        amountCoins: String((updated as any).amountCoins ?? ""),
        createdAt: updated.createdAt?.toISOString?.() ?? null,
        decidedAt: (updated as any).decidedAt?.toISOString?.() ?? null,
      };

      await tx.deliveryCompanyIdempotencyKey.update({
        where: { id: idemRow.id },
        data: { responseStatus: 200, responseBody: safeUpdated },
      });

      return safeUpdated;
    });

    const decision = nextStatus === "APPROVED" ? "APPROVE" : "REJECT";
    await logCompanyAudit(
      existingRequest.deliveryCompanyId,
      "BUDGET_REQUEST_DECIDED",
      "COMPANY",
      auth.superUserId,
      {
        requestId: id,
        decision,
        departmentId: existingRequest.departmentId,
        amountCoins: Number(existingRequest.amountCoins ?? 0),
      },
    );
    try {
      const recipientId = existingRequest.requestedByAccountId || existingRequest.departmentId;
      await emitDepartmentNotification(existingRequest.deliveryCompanyId, recipientId, "BUDGET_REQUEST_DECIDED", {
        requestId: id,
        decision,
        amountCoins: Number(existingRequest.amountCoins ?? 0),
        groupKey: `budget:${id}`,
      });
    } catch {
      // non-blocking notification dispatch
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
