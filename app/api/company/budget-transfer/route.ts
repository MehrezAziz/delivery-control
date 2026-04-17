import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const body = await req.json();
    const departmentId = String(body?.departmentId || "");
    const amountCoins = Number(body?.amountCoins || 0);
    if (!departmentId || !Number.isFinite(amountCoins) || amountCoins <= 0) {
      return NextResponse.json({ error: "departmentId and positive amountCoins are required" }, { status: 400 });
    }
    const db: any = prisma;
    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: departmentId, deliveryCompanyId: auth.companyId },
      select: { id: true, label: true, isMainDepartment: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (department.isMainDepartment) return NextResponse.json({ error: "Cannot transfer to main department" }, { status: 400 });

    const result = await db.$transaction(async (tx: any) => {
      const company = await tx.deliveryCompany.findUnique({
        where: { id: auth.companyId },
        select: { coinBalance: true, lockedCoins: true },
      });
      const available = Number(company?.coinBalance || 0) - Number(company?.lockedCoins || 0);
      if (available < amountCoins) throw new Error("Insufficient company available balance");

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
      await tx.deliveryCompanyTransaction.create({
        data: {
          deliveryCompanyId: auth.companyId,
          type: "DEPARTMENT_BUDGET_ALLOC",
          amount: -amountCoins,
          balanceAfter: newCompanyBalance,
          description: `Direct transfer to department ${department.id}`,
        },
      });

      return {
        departmentId: department.id,
        departmentLabel: department.label,
        amountCoins,
        departmentBalance: Number(wallet.availableCoins),
        companyBalance: newCompanyBalance,
      };
    });

    await logCompanyAudit(
      auth.companyId,
      "DEPARTMENT_BUDGET_TRANSFERRED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { departmentId: department.id, amountCoins },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to transfer coins";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
