import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import { defaultFirstNextRunAt, type BudgetCadence } from "@/lib/budget-schedule-utils";

const CADENCES: BudgetCadence[] = ["DAILY", "WEEKLY", "MONTHLY"];

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const db: any = prisma;
    const rows = await db.deliveryCompanyScheduledBudgetTransfer.findMany({
      where: { deliveryCompanyId: auth.companyId },
      orderBy: { nextRunAt: "asc" },
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
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load scheduled transfers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const db: any = prisma;
    const body = await req.json();
    const departmentAccountId = String(body?.departmentAccountId || "");
    const cadence = String(body?.cadence || "").toUpperCase() as BudgetCadence;
    const amountCoins = Number(body?.amountCoins ?? body?.amount ?? 0);
    if (!departmentAccountId || !CADENCES.includes(cadence)) {
      return NextResponse.json(
        { error: "departmentAccountId and cadence (DAILY | WEEKLY | MONTHLY) are required" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
      return NextResponse.json({ error: "amountCoins must be a positive number" }, { status: 400 });
    }

    const account = await db.deliveryCompanyDepartmentAccount.findFirst({
      where: { id: departmentAccountId, deliveryCompanyId: auth.companyId },
      select: { id: true, departmentId: true },
    });
    if (!account) return NextResponse.json({ error: "Department account not found" }, { status: 404 });

    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: account.departmentId, deliveryCompanyId: auth.companyId },
      select: { id: true, isMainDepartment: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (department.isMainDepartment) {
      return NextResponse.json({ error: "Cannot schedule transfers to the main department account" }, { status: 400 });
    }

    let nextRunAt: Date;
    if (body?.firstRunAt) {
      nextRunAt = new Date(String(body.firstRunAt));
      if (Number.isNaN(nextRunAt.getTime())) {
        return NextResponse.json({ error: "Invalid firstRunAt" }, { status: 400 });
      }
    } else {
      nextRunAt = defaultFirstNextRunAt(cadence);
    }

    const row = await db.deliveryCompanyScheduledBudgetTransfer.create({
      data: {
        deliveryCompanyId: auth.companyId,
        departmentAccountId: account.id,
        amountCoins,
        cadence,
        nextRunAt,
        isActive: body?.isActive === undefined ? true : !!body.isActive,
      },
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

    await logCompanyAudit(auth.companyId, "BUDGET_SCHEDULE_CREATED", "COMPANY", auth.departmentAccountId || auth.companyId, {
      scheduleId: row.id,
      departmentAccountId: account.id,
      cadence,
      amountCoins,
      nextRunAt: row.nextRunAt?.toISOString?.() ?? String(row.nextRunAt),
    });

    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create schedule";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
