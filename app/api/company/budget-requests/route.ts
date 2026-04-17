import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureCompanyRoleAllowed, isMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { createHash } from "crypto";
import { enforceCompanyRateLimit } from "@/lib/company-rate-limit";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR", "DEPT_VIEWER"]);
    const db: any = prisma;
    const rows = await db.deliveryCompanyDepartmentBudgetRequest.findMany({
      where: {
        deliveryCompanyId: auth.companyId,
        ...(isMainDepartmentActor(auth) ? {} : { departmentId: auth.departmentId || "__none__" }),
      },
      orderBy: { createdAt: "desc" },
      include: { department: { select: { id: true, label: true, isMainDepartment: true } } },
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load budget requests";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    if (isMainDepartmentActor(auth)) {
      return NextResponse.json({ error: "Main company cannot create budget requests. Department accounts must request coins." }, { status: 403 });
    }
    const idempotencyHeader = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idempotencyHeader) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }
    enforceCompanyRateLimit(
      ["company-budget-request-create", auth.companyId, auth.departmentId || "main", auth.actorRole || "MAIN_ADMIN"],
      20,
      60_000,
    );
    const db: any = prisma;
    const body = await req.json();
    if (!body?.amountCoins) {
      return NextResponse.json({ error: "amountCoins is required" }, { status: 400 });
    }
    const requestedDepartmentId = auth.departmentId || "__none__";
    const amountCoins = Number(body.amountCoins);
    if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
      return NextResponse.json({ error: "Invalid amountCoins" }, { status: 400 });
    }

    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: requestedDepartmentId, deliveryCompanyId: auth.companyId },
      select: { id: true, isMainDepartment: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    // Idempotency persistence check (critical write)
    const endpointKey = "delivery-control/budget-requests:POST";
    const idemKeyHeader = idempotencyHeader || undefined;
    const requestHash = createHash("sha256")
      .update(JSON.stringify(body) + "|" + String(auth.companyId) + "|" + String(department.id))
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

    const policy = await db.deliveryCompanyDepartmentBudgetPolicy.findUnique({
      where: { departmentId: department.id },
    });

    const company = await db.deliveryCompany.findUnique({
      where: { id: auth.companyId },
      select: { coinBalance: true, lockedCoins: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    const availableCompany = Number(company.coinBalance) - Number(company.lockedCoins || 0);

    const canAutoApprove =
      !!policy?.isAutoApproveEnabled &&
      amountCoins <= Number(policy.maxAutoApproveAmount || 0) &&
      availableCompany >= amountCoins;

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

      const request = await tx.deliveryCompanyDepartmentBudgetRequest.create({
        data: {
          deliveryCompanyId: auth.companyId,
          departmentId: requestedDepartmentId,
          amountCoins,
          priority: body.priority === "URGENT" ? "URGENT" : "NORMAL",
          status: canAutoApprove ? "AUTO_APPROVED" : "PENDING",
          decisionNote: canAutoApprove ? "Auto-approved by budget policy" : null,
          decidedAt: canAutoApprove ? new Date() : null,
          decidedBy: canAutoApprove ? "SYSTEM" : null,
        },
      });

      if (canAutoApprove) {
        const wallet = await tx.deliveryCompanyDepartmentBudgetWallet.upsert({
          where: { departmentId: department.id },
          create: {
            deliveryCompanyId: auth.companyId,
            departmentId: department.id,
            availableCoins: amountCoins,
          },
          update: {
            availableCoins: { increment: amountCoins },
          },
        });

        const newCompanyBalance = Number(company.coinBalance) - amountCoins;
        await tx.deliveryCompany.update({
          where: { id: auth.companyId },
          data: { coinBalance: newCompanyBalance },
        });

        await tx.deliveryCompanyTransaction.createMany({
          data: [
            {
              deliveryCompanyId: auth.companyId,
              type: "DEPARTMENT_BUDGET_ALLOC",
              amount: -amountCoins,
              balanceAfter: newCompanyBalance,
              description: `Budget allocated to department ${department.id}`,
            },
            {
              deliveryCompanyId: auth.companyId,
              type: "DEPARTMENT_BUDGET_ALLOC",
              amount: amountCoins,
              balanceAfter: Number(wallet.availableCoins),
              description: `Department budget wallet credit ${department.id}`,
            },
          ],
        });
      }

      const safeRequest = {
        ...request,
        amountCoins: String(request.amountCoins),
        decisionNote: request.decisionNote ?? null,
        decidedAt: request.decidedAt ? request.decidedAt.toISOString() : null,
        createdAt: request.createdAt ? request.createdAt.toISOString() : null,
      };

      await tx.deliveryCompanyIdempotencyKey.update({
        where: { id: idemRow.id },
        data: {
          responseStatus: 201,
          responseBody: safeRequest,
        },
      });

      return safeRequest;
    });
    await logCompanyAudit(
      auth.companyId,
      "BUDGET_REQUEST_CREATED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { departmentId: department.id, amountCoins, status: result.status },
    );
    await emitDepartmentNotification(
      auth.companyId,
      department.id,
      "BUDGET_REQUEST_CREATED",
      {
        requestId: result.id,
        amountCoins,
        priority: body.priority === "URGENT" ? "URGENT" : "NORMAL",
        status: result.status,
        groupKey: `budget:${result.id}`,
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create budget request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
