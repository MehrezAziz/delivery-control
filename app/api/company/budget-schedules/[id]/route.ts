import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import type { BudgetCadence } from "@/lib/budget-schedule-utils";

const CADENCES: BudgetCadence[] = ["DAILY", "WEEKLY", "MONTHLY"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const { id } = await ctx.params;
    const db: any = prisma;
    const body = await req.json();

    const existing = await db.deliveryCompanyScheduledBudgetTransfer.findFirst({
      where: { id, deliveryCompanyId: auth.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body?.isActive !== undefined) data.isActive = !!body.isActive;
    if (body?.amountCoins !== undefined) {
      const n = Number(body.amountCoins);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "amountCoins must be positive" }, { status: 400 });
      }
      data.amountCoins = n;
    }
    if (body?.cadence !== undefined) {
      const c = String(body.cadence).toUpperCase() as BudgetCadence;
      if (!CADENCES.includes(c)) return NextResponse.json({ error: "Invalid cadence" }, { status: 400 });
      data.cadence = c;
    }
    if (body?.nextRunAt !== undefined) {
      const d = new Date(String(body.nextRunAt));
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid nextRunAt" }, { status: 400 });
      data.nextRunAt = d;
      data.reminderForNextRunAt = null;
    }

    const row = await db.deliveryCompanyScheduledBudgetTransfer.update({
      where: { id },
      data,
      include: {
        departmentAccount: {
          select: {
            id: true,
            email: true,
            department: { select: { id: true, label: true, isMainDepartment: true } },
          },
        },
      },
    });

    await logCompanyAudit(auth.companyId, "BUDGET_SCHEDULE_UPDATED", "COMPANY", auth.departmentAccountId || auth.companyId, {
      scheduleId: id,
      patch: Object.keys(data),
    });

    return NextResponse.json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update schedule";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const { id } = await ctx.params;
    const db: any = prisma;

    const existing = await db.deliveryCompanyScheduledBudgetTransfer.findFirst({
      where: { id, deliveryCompanyId: auth.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    await db.deliveryCompanyScheduledBudgetTransfer.delete({ where: { id } });
    await logCompanyAudit(auth.companyId, "BUDGET_SCHEDULE_DELETED", "COMPANY", auth.departmentAccountId || auth.companyId, {
      scheduleId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete schedule";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
