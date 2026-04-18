import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { transferCompanyCoinsToDepartmentBudgetWallet } from "@/lib/department-budget-transfer";
import { computeNextRunAfter, type BudgetCadence } from "@/lib/budget-schedule-utils";

function authCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization");
  const fromBearer = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
  const fromHeader = req.headers.get("x-cron-secret")?.trim() ?? "";
  return fromBearer === secret || fromHeader === secret;
}

/** Remind main ~24h before nextRunAt if company balance cannot cover the scheduled amount. Process due runs. */
export async function POST(req: NextRequest) {
  if (!authCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db: any = prisma;
  const now = new Date();
  const reminderHorizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = await db.deliveryCompanyScheduledBudgetTransfer.findMany({
    where: {
      isActive: true,
      nextRunAt: { gt: now, lte: reminderHorizon },
    },
    include: {
      departmentAccount: { select: { id: true, email: true, departmentId: true } },
    },
  });

  let remindersSent = 0;
  for (const s of upcoming) {
    const company = await db.deliveryCompany.findUnique({
      where: { id: s.deliveryCompanyId },
      select: { coinBalance: true, lockedCoins: true },
    });
    if (!company) continue;
    const available = Number(company.coinBalance) - Number(company.lockedCoins || 0);
    const need = Number(s.amountCoins);
    if (available >= need) continue;

    const already = s.reminderForNextRunAt && new Date(s.reminderForNextRunAt).getTime() === new Date(s.nextRunAt).getTime();
    if (already) continue;

    await emitDepartmentNotification(s.deliveryCompanyId, s.deliveryCompanyId, "SCHEDULED_BUDGET_INSUFFICIENT_REMINDER_MAIN", {
      scheduleId: s.id,
      amountCoins: need,
      nextRunAt: s.nextRunAt.toISOString(),
      accountEmail: s.departmentAccount?.email ?? "",
      groupKey: `scheduled-budget:reminder:${s.id}:${s.nextRunAt.toISOString()}`,
    });

    await db.deliveryCompanyScheduledBudgetTransfer.update({
      where: { id: s.id },
      data: { reminderForNextRunAt: s.nextRunAt },
    });
    remindersSent += 1;
  }

  const due = await db.deliveryCompanyScheduledBudgetTransfer.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
    include: {
      departmentAccount: { select: { id: true, email: true, departmentId: true } },
    },
    orderBy: { nextRunAt: "asc" },
  });

  let runsOk = 0;
  let runsSkipped = 0;
  for (const s of due) {
    const cadence = String(s.cadence) as BudgetCadence;
    const amountCoins = Number(s.amountCoins);
    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: s.departmentAccount.departmentId, deliveryCompanyId: s.deliveryCompanyId },
      select: { id: true, isMainDepartment: true },
    });
    if (!department || department.isMainDepartment) {
      const nextRunAt = computeNextRunAfter(new Date(s.nextRunAt), cadence);
      await db.deliveryCompanyScheduledBudgetTransfer.update({
        where: { id: s.id },
        data: { nextRunAt, lastRunAt: now, reminderForNextRunAt: null },
      });
      runsSkipped += 1;
      continue;
    }

    try {
      await db.$transaction(async (tx: any) => {
        await transferCompanyCoinsToDepartmentBudgetWallet(tx, {
          companyId: s.deliveryCompanyId,
          departmentId: department.id,
          amountCoins,
          description: `Scheduled budget (${cadence}) to department ${department.id}`,
        });
        const nextRunAt = computeNextRunAfter(new Date(s.nextRunAt), cadence);
        await tx.deliveryCompanyScheduledBudgetTransfer.update({
          where: { id: s.id },
          data: {
            lastRunAt: now,
            nextRunAt,
            reminderForNextRunAt: null,
          },
        });
      });
      runsOk += 1;
    } catch {
      const nextRunAt = computeNextRunAfter(new Date(s.nextRunAt), cadence);
      await db.deliveryCompanyScheduledBudgetTransfer.update({
        where: { id: s.id },
        data: { nextRunAt, lastRunAt: now, reminderForNextRunAt: null },
      });
      await emitDepartmentNotification(s.deliveryCompanyId, s.deliveryCompanyId, "SCHEDULED_BUDGET_RUN_SKIPPED_MAIN", {
        scheduleId: s.id,
        amountCoins,
        reason: "insufficient_balance",
        groupKey: `scheduled-budget:skip:${s.id}:${now.toISOString()}`,
      });
      runsSkipped += 1;
    }
  }

  return NextResponse.json({ ok: true, remindersSent, runsOk, runsSkipped, processedDue: due.length });
}
