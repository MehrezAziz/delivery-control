import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const db: any = prisma;
    const rows = await db.deliveryCompanyDepartmentBudgetPolicy.findMany({
      where: { deliveryCompanyId: auth.companyId },
      orderBy: { createdAt: "desc" },
      include: { department: { select: { id: true, label: true, isMainDepartment: true } } },
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load budget policies";
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
    if (!body?.departmentId || !body?.periodType) {
      return NextResponse.json({ error: "departmentId and periodType are required" }, { status: 400 });
    }
    const department = await db.deliveryCompanyAddress.findFirst({
      where: { id: String(body.departmentId), deliveryCompanyId: auth.companyId },
      select: { id: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    const policy = await db.deliveryCompanyDepartmentBudgetPolicy.upsert({
      where: { departmentId: String(body.departmentId) },
      create: {
        deliveryCompanyId: auth.companyId,
        departmentId: String(body.departmentId),
        periodType: body.periodType,
        intervalDays: body.intervalDays ?? null,
        maxAutoApproveAmount: Number(body.maxAutoApproveAmount || 0),
        minHoursBetweenReq: Number(body.minHoursBetweenReq || 0),
        isAutoApproveEnabled: !!body.isAutoApproveEnabled,
      },
      update: {
        periodType: body.periodType,
        intervalDays: body.intervalDays ?? null,
        maxAutoApproveAmount: Number(body.maxAutoApproveAmount || 0),
        minHoursBetweenReq: Number(body.minHoursBetweenReq || 0),
        isAutoApproveEnabled: !!body.isAutoApproveEnabled,
        isActive: body.isActive === undefined ? true : !!body.isActive,
      },
    });
    await logCompanyAudit(
      auth.companyId,
      "BUDGET_POLICY_UPSERTED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { policyId: policy.id, departmentId: policy.departmentId, periodType: policy.periodType, auto: policy.isAutoApproveEnabled },
    );
    return NextResponse.json(policy);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save budget policy";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
