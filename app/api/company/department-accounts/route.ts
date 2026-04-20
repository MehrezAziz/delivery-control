import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import {
  ensureCompanyIsActive,
  ensureMainDepartmentActor,
  isMainDepartmentActor,
  logCompanyAudit,
} from "@/lib/company-security";

const departmentInclude = {
  department: {
    select: {
      id: true,
      label: true,
      isMainDepartment: true,
      country: true,
      city: true,
      street: true,
      postalCode: true,
      latitude: true,
      longitude: true,
    },
  },
} as const;

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    const db: any = prisma;

    /** Main company: all accounts. Department login: only own row (same shape for budgets UI). */
    if (isMainDepartmentActor(auth)) {
      const rows = await db.deliveryCompanyDepartmentAccount.findMany({
        where: { deliveryCompanyId: auth.companyId },
        orderBy: { createdAt: "desc" },
        include: departmentInclude,
      });
      return NextResponse.json(rows);
    }

    if (!auth.departmentAccountId) {
      return NextResponse.json([]);
    }

    const row = await db.deliveryCompanyDepartmentAccount.findFirst({
      where: { id: auth.departmentAccountId, deliveryCompanyId: auth.companyId },
      include: departmentInclude,
    });
    return NextResponse.json(row ? [row] : []);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load department accounts";
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
    if (!body?.email || !body?.password || !body?.role || !body?.departmentId) {
      return NextResponse.json({ error: "email, password, role and departmentId are required" }, { status: 400 });
    }

    const departmentId = String(body.departmentId);
    const targetDepartment = await db.deliveryCompanyAddress.findFirst({
      where: { id: departmentId, deliveryCompanyId: auth.companyId },
      select: { id: true, isMainDepartment: true },
    });
    if (!targetDepartment) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (targetDepartment.isMainDepartment) {
      return NextResponse.json(
        { error: "Main department is reserved for the main company and cannot be assigned to department accounts" },
        { status: 400 },
      );
    }

    const created = await db.deliveryCompanyDepartmentAccount.create({
      data: {
        deliveryCompanyId: auth.companyId,
        departmentId,
        email: String(body.email).toLowerCase().trim(),
        passwordHash: await bcrypt.hash(String(body.password), 10),
        role: body.role,
      },
    });
    await logCompanyAudit(
      auth.companyId,
      "DEPARTMENT_ACCOUNT_CREATED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { targetDepartmentId: departmentId, email: String(body.email).toLowerCase().trim(), role: body.role },
    );
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create department account";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
