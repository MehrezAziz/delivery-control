import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import { transferCompanyCoinsToDepartmentBudgetWallet } from "@/lib/department-budget-transfer";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const body = await req.json();
    const departmentAccountId = String(body?.departmentAccountId || body?.departmentId || "");
    const amountCoins = Number(body?.amountCoins || 0);
    if (!departmentAccountId || !Number.isFinite(amountCoins) || amountCoins <= 0) {
      return NextResponse.json(
        { error: "departmentAccountId (or legacy departmentId) and positive amountCoins are required" },
        { status: 400 },
      );
    }
    const db: any = prisma;
    const account = await db.deliveryCompanyDepartmentAccount.findFirst({
      where: { id: departmentAccountId, deliveryCompanyId: auth.companyId },
      select: { id: true, email: true, departmentId: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Department account not found" }, { status: 404 });
    }
    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: account.departmentId, deliveryCompanyId: auth.companyId },
      select: { id: true, label: true, isMainDepartment: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (department.isMainDepartment) return NextResponse.json({ error: "Cannot transfer to main department" }, { status: 400 });

    const result = await db.$transaction(async (tx: any) => {
      const { newCompanyBalance, walletAvailable } = await transferCompanyCoinsToDepartmentBudgetWallet(tx, {
        companyId: auth.companyId,
        departmentId: department.id,
        amountCoins,
        description: `Direct transfer to department ${department.id}`,
      });

      return {
        departmentAccountId: account.id,
        departmentAccountEmail: account.email,
        departmentId: department.id,
        departmentLabel: department.label,
        amountCoins,
        departmentBalance: walletAvailable,
        companyBalance: newCompanyBalance,
      };
    });

    await logCompanyAudit(
      auth.companyId,
      "DEPARTMENT_BUDGET_TRANSFERRED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { departmentAccountId: account.id, departmentId: department.id, amountCoins },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to transfer coins";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
