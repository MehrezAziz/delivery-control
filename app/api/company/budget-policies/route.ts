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
    const deptAccountId = String(body?.departmentAccountId || body?.departmentId || "");
    if (!deptAccountId || !body?.periodType) {
      return NextResponse.json({ error: "departmentAccountId and periodType are required" }, { status: 400 });
    }
    const account = await db.deliveryCompanyDepartmentAccount.findFirst({
      where: { id: deptAccountId, deliveryCompanyId: auth.companyId },
      select: { id: true, email: true },
    });
    if (!account) return NextResponse.json({ error: "Department account not found" }, { status: 404 });

    const policy = await db.deliveryCompanyDepartmentBudgetPolicy.upsert({
      where: { departmentAccountId: account.id },
      create: {
        deliveryCompanyId: auth.companyId,
        departmentAccountId: account.id,
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
      {
        policyId: policy.id,
        departmentAccountId: policy.departmentAccountId,
        periodType: policy.periodType,
        auto: policy.isAutoApproveEnabled,
      },
    );
    return NextResponse.json(policy);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save budget policy";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
