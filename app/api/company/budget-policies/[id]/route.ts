import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const { id } = await ctx.params;
    const db: any = prisma;

    const existing = await db.deliveryCompanyDepartmentBudgetPolicy.findFirst({
      where: { id, deliveryCompanyId: auth.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    await db.deliveryCompanyDepartmentBudgetPolicy.delete({ where: { id } });
    await logCompanyAudit(auth.companyId, "BUDGET_POLICY_DELETED", "COMPANY", auth.departmentAccountId || auth.companyId, {
      policyId: id,
      departmentAccountId: existing.departmentAccountId,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete policy";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
