import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import { emitDepartmentNotification } from "@/lib/company-notifications";
import { recallDepartmentBudgetWalletToCompany } from "@/lib/department-budget-recall";

/** Main company only: pull coins from a department budget wallet back to the company wallet. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);

    const db: any = prisma;
    const body = await req.json();
    const departmentAccountId = String(body?.departmentAccountId || "");
    const amountCoins = Number(body?.amountCoins ?? 0);
    if (!departmentAccountId || !Number.isFinite(amountCoins) || amountCoins <= 0) {
      return NextResponse.json(
        { error: "departmentAccountId and positive amountCoins are required" },
        { status: 400 },
      );
    }

    const account = await db.deliveryCompanyDepartmentAccount.findFirst({
      where: { id: departmentAccountId, deliveryCompanyId: auth.companyId },
      select: { id: true, email: true, departmentId: true },
    });
    if (!account) return NextResponse.json({ error: "Department account not found" }, { status: 404 });

    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: account.departmentId, deliveryCompanyId: auth.companyId },
      select: { id: true, label: true, isMainDepartment: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (department.isMainDepartment) {
      return NextResponse.json({ error: "Cannot recall from main department wallet this way" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx: any) => {
      return recallDepartmentBudgetWalletToCompany(tx, {
        companyId: auth.companyId,
        departmentId: department.id,
        departmentLabel: department.label,
        amountCoins,
      });
    });

    await logCompanyAudit(auth.companyId, "DEPARTMENT_BUDGET_RECALL", "COMPANY", auth.departmentAccountId || auth.companyId, {
      departmentAccountId: account.id,
      departmentId: department.id,
      amountCoins,
    });

    await emitDepartmentNotification(auth.companyId, account.id, "BUDGET_RECALL_FROM_COMPANY_DEPT", {
      amountCoins,
      departmentLabel: department.label,
      groupKey: `budget-recall:${Date.now()}`,
    });

    return NextResponse.json(
      {
        departmentAccountId: account.id,
        departmentAccountEmail: account.email,
        departmentId: department.id,
        amountCoins,
        companyBalance: result.newCompanyBalance,
        departmentWalletAvailable: result.walletAvailable,
      },
      { status: 201 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to recall budget coins";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
