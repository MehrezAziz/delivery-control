import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const db: any = prisma;
    const { id } = await context.params;
    const body = await req.json();
    const updated = await db.deliveryCompanyDepartmentAccount.updateMany({
      where: { id, deliveryCompanyId: auth.companyId },
      data: {
        status: body?.status || undefined,
        role: body?.role || undefined,
      },
    });
    if (!updated.count) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    await logCompanyAudit(
      auth.companyId,
      "DEPARTMENT_ACCOUNT_UPDATED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { accountId: id, status: body?.status, role: body?.role },
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update department account";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
