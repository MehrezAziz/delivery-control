import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed, isMainDepartmentActor, logCompanyAudit } from "@/lib/company-security";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR", "DEPT_VIEWER"]);
    const rows = await prisma.deliveryCompanyAddress.findMany({
      where: {
        deliveryCompanyId: auth.companyId,
        ...(isMainDepartmentActor(auth) ? {} : { id: auth.departmentId || "__none__" }),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load departments";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN"]);
    const body = await req.json();
    if (!body?.label || !body?.country || !body?.governorate || !body?.delegation) {
      return NextResponse.json({ error: "Country, governorate, delegation and label are required" }, { status: 400 });
    }
    if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
      return NextResponse.json({ error: "Coordinates are required" }, { status: 400 });
    }
    const created = await prisma.deliveryCompanyAddress.create({
      data: {
        deliveryCompanyId: auth.companyId,
        label: String(body.label),
        contactEmail: body.contactEmail ? String(body.contactEmail).trim() : null,
        country: String(body.country),
        city: String(body.governorate),
        street: String(body.delegation),
        postalCode: body.delegationId ? String(body.delegationId) : null,
        latitude: body.latitude,
        longitude: body.longitude,
        isDefault: !!body.isDefault,
      // contactEmail: run `npx prisma generate` after migrations so types include this field
      } as any,
    });
    await logCompanyAudit(
      auth.companyId,
      "DEPARTMENT_CREATED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { departmentId: created.id, label: created.label },
    );
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create department";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN"]);
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "Department id is required" }, { status: 400 });
    const where: any = { id: String(body.id), deliveryCompanyId: auth.companyId };
    if (!isMainDepartmentActor(auth)) where.id = auth.departmentId || "__none__";
    const updated = await prisma.deliveryCompanyAddress.updateMany({
      where,
      data: {
        label: body.label ? String(body.label) : undefined,
        contactEmail: body.contactEmail !== undefined ? (body.contactEmail ? String(body.contactEmail).trim() : null) : undefined,
        country: body.country ? String(body.country) : undefined,
        city: body.governorate ? String(body.governorate) : undefined,
        street: body.delegation ? String(body.delegation) : undefined,
        postalCode: body.delegationId ? String(body.delegationId) : undefined,
        latitude: typeof body.latitude === "number" ? body.latitude : undefined,
        longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      } as any,
    });
    if (!updated.count) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    await logCompanyAudit(
      auth.companyId,
      "DEPARTMENT_UPDATED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      { departmentId: String(body.id) },
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update department";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
