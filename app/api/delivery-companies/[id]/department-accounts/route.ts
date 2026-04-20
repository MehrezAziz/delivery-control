import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCsAllowedGovernorateIdsForDepartmentAccounts } from "@/lib/cs-department-account-scope";
/** Admin or CS (MANAGE_DELIVERY_COMPANY) — CS only sees accounts whose department delegation is in assigned governorates. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id: companyId } = await ctx.params;
    const allowed = await getCsAllowedGovernorateIdsForDepartmentAccounts(auth);
    const db: any = prisma;
    const where: any = { deliveryCompanyId: companyId };
    if (allowed !== "all") {
      if (allowed.length === 0) return NextResponse.json([]);
      where.department = { delegation: { governorateId: { in: allowed } } };
    }
    const rows = await db.deliveryCompanyDepartmentAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        department: {
          select: {
            id: true,
            label: true,
            isMainDepartment: true,
            country: true,
            city: true,
            street: true,
            delegationId: true,
            delegation: { select: { id: true, nameDelegation: true, governorateId: true } },
          },
        },
      },
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id: companyId } = await ctx.params;
    const body = await req.json();
    if (!body?.email || !body?.password || !body?.role || !body?.departmentId) {
      return NextResponse.json({ error: "email, password, role and departmentId are required" }, { status: 400 });
    }
    const departmentId = String(body.departmentId);
    const db: any = prisma;
    const dept = await db.deliveryCompanyAddress.findFirst({
      where: { id: departmentId, deliveryCompanyId: companyId },
      include: { delegation: { select: { governorateId: true } } },
    });
    if (!dept) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (auth.role === "CUSTOMER_SERVICE") {
      const allowed = await getCsAllowedGovernorateIdsForDepartmentAccounts(auth);
      if (allowed !== "all") {
        const gId = dept.delegation?.governorateId as string | undefined;
        if (!gId || !allowed.includes(gId)) {
          return NextResponse.json({ error: "You cannot create accounts for this department" }, { status: 403 });
        }
      }
    }

    const created = await db.deliveryCompanyDepartmentAccount.create({
      data: {
        deliveryCompanyId: companyId,
        departmentId,
        email: String(body.email).toLowerCase().trim(),
        passwordHash: await bcrypt.hash(String(body.password), 10),
        role: body.role,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
