import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import {
  ensureCompanyIsActive,
  ensureCompanyRoleAllowed,
  isMainDepartmentActor,
  logCompanyAudit,
} from "@/lib/company-security";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { normalizeBudgetRequestPriority } from "@/lib/urgent-budget-auto-approve";
import { evaluateUrgentBudgetAutoApprove } from "@/lib/evaluate-urgent-budget-auto-approve";

/** Department account: update amount/priority while PENDING. Re-runs urgent auto-approve rules. Main is notified. */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    if (isMainDepartmentActor(auth)) {
      return NextResponse.json({ error: "Only department accounts can edit their own budget requests." }, { status: 403 });
    }
    if (!auth.departmentAccountId) {
      return NextResponse.json({ error: "Department account required" }, { status: 403 });
    }

    const { id } = await context.params;
    const db: any = prisma;
    const body = await req.json();
    const amountCoins =
      body?.amountCoins !== undefined ? Number(body.amountCoins) : undefined;
    const priorityRaw = body?.priority;

    if (amountCoins === undefined && priorityRaw === undefined) {
      return NextResponse.json({ error: "Provide amountCoins and/or priority" }, { status: 400 });
    }

    const existing = await db.deliveryCompanyDepartmentBudgetRequest.findFirst({
      where: {
        id,
        deliveryCompanyId: auth.companyId,
        requestedByAccountId: auth.departmentAccountId,
        status: "PENDING",
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Budget request not found, not yours, or no longer pending" },
        { status: 404 },
      );
    }

    const nextAmount = amountCoins !== undefined ? amountCoins : Number(existing.amountCoins);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return NextResponse.json({ error: "Invalid amountCoins" }, { status: 400 });
    }

    const priorityEnum =
      priorityRaw !== undefined ? normalizeBudgetRequestPriority(priorityRaw) : existing.priority;

    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: existing.departmentId, deliveryCompanyId: auth.companyId },
      select: { id: true, isMainDepartment: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    const evalResult = await evaluateUrgentBudgetAutoApprove(db, {
      companyId: auth.companyId,
      departmentAccountId: auth.departmentAccountId,
      amountCoins: nextAmount,
      priorityEnum,
      excludeRequestId: id,
    });

    const { canUrgentAutoApprove, urgentDenialNote, company } = evalResult;
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const result = await db.$transaction(async (tx: any) => {
      if (canUrgentAutoApprove) {
        const wallet = await tx.deliveryCompanyDepartmentBudgetWallet.upsert({
          where: { departmentId: department.id },
          create: {
            deliveryCompanyId: auth.companyId,
            departmentId: department.id,
            availableCoins: nextAmount,
          },
          update: { availableCoins: { increment: nextAmount } },
        });

        const newCompanyBalance = Number(company.coinBalance) - nextAmount;
        await tx.deliveryCompany.update({
          where: { id: auth.companyId },
          data: { coinBalance: newCompanyBalance },
        });

        await tx.deliveryCompanyTransaction.createMany({
          data: [
            {
              deliveryCompanyId: auth.companyId,
              type: "DEPARTMENT_BUDGET_ALLOC",
              amount: -nextAmount,
              balanceAfter: newCompanyBalance,
              description: `Budget allocated to department ${department.id} (request ${id} updated)`,
            },
            {
              deliveryCompanyId: auth.companyId,
              type: "DEPARTMENT_BUDGET_ALLOC",
              amount: nextAmount,
              balanceAfter: Number(wallet.availableCoins),
              description: `Department budget wallet credit ${department.id} (request ${id} updated)`,
            },
          ],
        });

        const updated = await tx.deliveryCompanyDepartmentBudgetRequest.update({
          where: { id },
          data: {
            amountCoins: nextAmount,
            priority: priorityEnum,
            status: "AUTO_APPROVED",
            decisionNote: "Auto-approved: urgent request matched account policy after edit",
            decidedAt: new Date(),
            decidedBy: "SYSTEM",
          },
        });
        return { updated, mode: "auto" as const };
      }

      const updated = await tx.deliveryCompanyDepartmentBudgetRequest.update({
        where: { id },
        data: {
          amountCoins: nextAmount,
          priority: priorityEnum,
          decisionNote: priorityEnum === "URGENT" ? urgentDenialNote : null,
          decidedAt: null,
          decidedBy: null,
        },
      });
      return { updated, mode: "pending" as const };
    });

    await logCompanyAudit(auth.companyId, "BUDGET_REQUEST_UPDATED", "COMPANY", auth.departmentAccountId, {
      requestId: id,
      amountCoins: nextAmount,
      priority: priorityEnum,
      status: result.updated.status,
    });

    let accountEmail = "";
    const acc = await db.deliveryCompanyDepartmentAccount.findUnique({
      where: { id: auth.departmentAccountId },
      select: { email: true },
    });
    accountEmail = acc?.email?.trim() ?? "";

    if (result.mode === "auto") {
      await emitDepartmentNotification(auth.companyId, auth.departmentAccountId, "BUDGET_REQUEST_DECIDED", {
        requestId: id,
        decision: "APPROVE",
        amountCoins: nextAmount,
        groupKey: `budget:${id}`,
      });
      await emitDepartmentNotification(auth.companyId, auth.companyId, "BUDGET_AUTO_URGENT_INFO_MAIN", {
        requestId: id,
        accountEmail,
        amountCoins: nextAmount,
        groupKey: `budget:auto:${id}`,
      });
    } else {
      await emitDepartmentNotification(auth.companyId, auth.companyId, "BUDGET_REQUEST_UPDATED_MAIN", {
        requestId: id,
        accountEmail,
        amountCoins: nextAmount,
        priority: priorityEnum,
        groupKey: `budget:${id}`,
      });
    }

    const u = result.updated;
    return NextResponse.json({
      ...u,
      amountCoins: String(u.amountCoins),
      createdAt: u.createdAt?.toISOString?.() ?? null,
      decidedAt: u.decidedAt?.toISOString?.() ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update budget request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Department account: cancel own request while PENDING. */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    if (isMainDepartmentActor(auth) || !auth.departmentAccountId) {
      return NextResponse.json({ error: "Only department accounts can cancel their own pending requests." }, { status: 403 });
    }

    const { id } = await context.params;
    const db: any = prisma;

    const existing = await db.deliveryCompanyDepartmentBudgetRequest.findFirst({
      where: {
        id,
        deliveryCompanyId: auth.companyId,
        requestedByAccountId: auth.departmentAccountId,
        status: "PENDING",
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Budget request not found, not yours, or no longer pending" },
        { status: 404 },
      );
    }

    const updated = await db.deliveryCompanyDepartmentBudgetRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        decisionNote: "Cancelled by department account before company decision",
        decidedAt: new Date(),
        decidedBy: "REQUESTER",
      },
    });

    await logCompanyAudit(auth.companyId, "BUDGET_REQUEST_CANCELLED", "COMPANY", auth.departmentAccountId, {
      requestId: id,
    });

    let accountEmail = "";
    const acc = await db.deliveryCompanyDepartmentAccount.findUnique({
      where: { id: auth.departmentAccountId },
      select: { email: true },
    });
    accountEmail = acc?.email?.trim() ?? "";

    await emitDepartmentNotification(auth.companyId, auth.companyId, "BUDGET_REQUEST_CANCELLED_MAIN", {
      requestId: id,
      accountEmail,
      amountCoins: Number(existing.amountCoins || 0),
      groupKey: `budget:cancel:${id}`,
    });

    return NextResponse.json({
      ...updated,
      amountCoins: String(updated.amountCoins),
      createdAt: updated.createdAt?.toISOString?.() ?? null,
      decidedAt: updated.decidedAt?.toISOString?.() ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to cancel budget request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
