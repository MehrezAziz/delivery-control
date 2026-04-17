import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor, ensureMainDepartmentExists, logCompanyAudit } from "@/lib/company-security";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const db: any = prisma;
    const rows = await db.deliveryCompanyDepartmentAccount.findMany({
      where: { deliveryCompanyId: auth.companyId },
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
            postalCode: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    return NextResponse.json(rows);
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
    const mainDepartmentId = await ensureMainDepartmentExists(auth.companyId);
    const body = await req.json();
    if (!body?.email || !body?.password || !body?.role) {
      return NextResponse.json({ error: "email, password and role are required" }, { status: 400 });
    }

    const departmentId = String(body.departmentId || mainDepartmentId);
    const targetDepartment = await db.deliveryCompanyAddress.findFirst({
      where: { id: departmentId, deliveryCompanyId: auth.companyId },
      select: { id: true },
    });
    if (!targetDepartment) return NextResponse.json({ error: "Department not found" }, { status: 404 });

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
