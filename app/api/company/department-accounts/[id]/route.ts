import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";
import bcrypt from "bcryptjs";

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
    const nextDepartmentId = body?.departmentId ? String(body.departmentId) : undefined;
    if (nextDepartmentId) {
      const dep = await db.deliveryCompanyAddress.findFirst({
        where: { id: nextDepartmentId, deliveryCompanyId: auth.companyId },
        select: { id: true, isMainDepartment: true },
      });
      if (!dep) return NextResponse.json({ error: "Department not found" }, { status: 404 });
      if (dep.isMainDepartment) {
        return NextResponse.json(
          { error: "Main department is reserved for the main company and cannot be assigned to department accounts" },
          { status: 400 },
        );
      }
    }
    const updated = await db.deliveryCompanyDepartmentAccount.updateMany({
      where: { id, deliveryCompanyId: auth.companyId },
      data: {
        status: body?.status || undefined,
        role: body?.role || undefined,
        departmentId: nextDepartmentId,
        email: body?.email ? String(body.email).toLowerCase().trim() : undefined,
        passwordHash: body?.password ? await bcrypt.hash(String(body.password), 10) : undefined,
      },
    });
    if (!updated.count) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    await logCompanyAudit(
      auth.companyId,
      "DEPARTMENT_ACCOUNT_UPDATED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      {
        accountId: id,
        status: body?.status,
        role: body?.role,
        departmentId: nextDepartmentId,
        email: body?.email ? String(body.email).toLowerCase().trim() : undefined,
        passwordChanged: !!body?.password,
      },
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update department account";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
