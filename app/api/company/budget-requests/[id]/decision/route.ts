import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { createHash } from "crypto";
import { enforceCompanyRateLimit } from "@/lib/company-rate-limit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const idempotencyHeader = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idempotencyHeader) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }
    enforceCompanyRateLimit(
      ["company-budget-request-decision", auth.companyId, auth.departmentId || "main", auth.actorRole || "MAIN_ADMIN"],
      20,
      60_000,
    );
    const db: any = prisma;
    const { id } = await context.params;
    const body = await req.json();
    const decision = String(body?.decision || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return NextResponse.json({ error: "decision must be APPROVE or REJECT" }, { status: 400 });
    }

    // Idempotency persistence check (critical write decision)
    const endpointKey = "delivery-control/budget-requests:DECISION";
    const idemKeyHeader = idempotencyHeader || undefined;
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          budgetRequestId: id,
          decision,
          decisionNote: body?.decisionNote ?? null,
        }) +
          "|" +
          String(auth.companyId),
      )
      .digest("hex");
    const idempotencyKey = idemKeyHeader;

    const existing = await db.deliveryCompanyIdempotencyKey.findFirst({
      where: { deliveryCompanyId: auth.companyId, endpointKey, idempotencyKey },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return NextResponse.json({ error: "Idempotency key used with a different request body" }, { status: 409 });
      }
      if (existing.responseBody) {
        return NextResponse.json(existing.responseBody, { status: existing.responseStatus || 200 });
      }
      return NextResponse.json({ error: "Idempotency request is in progress; please retry" }, { status: 409 });
    }

    const request = await db.deliveryCompanyDepartmentBudgetRequest.findFirst({
      where: { id, deliveryCompanyId: auth.companyId },
    });
    if (!request) return NextResponse.json({ error: "Budget request not found" }, { status: 404 });
    if (!["PENDING"].includes(request.status)) {
      return NextResponse.json({ error: "Budget request is not pending" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx: any) => {
      const idemRow = await tx.deliveryCompanyIdempotencyKey.create({
        data: {
          deliveryCompanyId: auth.companyId,
          actorRef: auth.departmentAccountId || auth.companyId,
          endpointKey,
          idempotencyKey,
          requestHash,
          responseStatus: 0,
          responseBody: null,
        },
      });

      if (decision === "REJECT") {
        const updated = await tx.deliveryCompanyDepartmentBudgetRequest.update({
          where: { id: request.id },
          data: {
            status: "REJECTED",
            decisionNote: body?.decisionNote || null,
            decidedBy: "MAIN_ADMIN",
            decidedAt: new Date(),
          },
        });
        const finalResponse = { success: true, decision, result: updated };
        await tx.deliveryCompanyIdempotencyKey.update({
          where: { id: idemRow.id },
          data: {
            responseStatus: 200,
            responseBody: {
              success: true,
              decision,
              result: {
                ...updated,
                amountCoins: String(updated.amountCoins),
                createdAt: updated.createdAt ? updated.createdAt.toISOString() : null,
                decidedAt: updated.decidedAt ? updated.decidedAt.toISOString() : null,
              },
            },
          },
        });
        return finalResponse;
      }

      const company = await tx.deliveryCompany.findUnique({
        where: { id: auth.companyId },
        select: { coinBalance: true, lockedCoins: true },
      });
      const available = Number(company?.coinBalance || 0) - Number(company?.lockedCoins || 0);
      const amount = Number(request.amountCoins || 0);
      if (amount > available) throw new Error("Insufficient company available balance");

      const wallet = await tx.deliveryCompanyDepartmentBudgetWallet.upsert({
        where: { departmentId: request.departmentId },
        create: {
          deliveryCompanyId: auth.companyId,
          departmentId: request.departmentId,
          availableCoins: amount,
        },
        update: { availableCoins: { increment: amount } },
      });

      const newCompanyBalance = Number(company.coinBalance) - amount;
      await tx.deliveryCompany.update({
        where: { id: auth.companyId },
        data: { coinBalance: newCompanyBalance },
      });

      await tx.deliveryCompanyTransaction.create({
        data: {
          deliveryCompanyId: auth.companyId,
          type: "DEPARTMENT_BUDGET_ALLOC",
          amount: -amount,
          balanceAfter: newCompanyBalance,
          description: `Manual budget approval for department ${request.departmentId}`,
        },
      });

      await tx.deliveryCompanyDepartmentBudgetRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          decisionNote: body?.decisionNote || null,
          decidedBy: "MAIN_ADMIN",
          decidedAt: new Date(),
        },
      });

      const finalResponse = { success: true, decision, result: wallet };
      await tx.deliveryCompanyIdempotencyKey.update({
        where: { id: idemRow.id },
        data: {
          responseStatus: 200,
          responseBody: {
            success: true,
            decision,
            result: {
              ...wallet,
              availableCoins: String(wallet.availableCoins),
              createdAt: wallet.createdAt ? wallet.createdAt.toISOString() : null,
              updatedAt: wallet.updatedAt ? wallet.updatedAt.toISOString() : null,
            },
          },
        },
      });
      return finalResponse;
    });

    await logCompanyAudit(
      auth.companyId,
      "BUDGET_REQUEST_DECIDED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { requestId: request.id, decision, departmentId: request.departmentId, amountCoins: request.amountCoins },
    );
    await emitDepartmentNotification(
      auth.companyId,
      request.departmentId,
      "BUDGET_REQUEST_DECIDED",
      { requestId: request.id, decision, amountCoins: Number(request.amountCoins || 0) },
    );

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to decide budget request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
