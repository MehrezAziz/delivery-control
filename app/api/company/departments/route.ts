import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import {
  ensureCompanyRoleAllowed,
  isMainDepartmentActor,
  logCompanyAudit,
  repairDepartmentMainDefaultInvariants,
} from "@/lib/company-security";

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
    const existingCount = await prisma.deliveryCompanyAddress.count({
      where: { deliveryCompanyId: auth.companyId },
    });
    const isFirstDepartment = existingCount === 0;
    const created = await prisma.deliveryCompanyAddress.create({
      data: {
        deliveryCompanyId: auth.companyId,
        label: String(body.label),
        contactEmail: body.contactEmail ? String(body.contactEmail).trim() : null,
        country: String(body.country),
        city: String(body.governorate),
        street: String(body.delegation),
        postalCode: body.postalCode != null && String(body.postalCode).trim() ? String(body.postalCode).trim() : null,
        delegationId: body.delegationId ? String(body.delegationId) : null,
        latitude: body.latitude,
        longitude: body.longitude,
        isDefault: isFirstDepartment || !!body.isDefault,
        isMainDepartment: isFirstDepartment || !!body.isMainDepartment,
      // contactEmail: run `npx prisma generate` after migrations so types include this field
      } as any,
    });
    await repairDepartmentMainDefaultInvariants(auth.companyId);
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

    const deptId = String(body.id);
    const where: any = { id: deptId, deliveryCompanyId: auth.companyId };
    if (!isMainDepartmentActor(auth)) where.id = auth.departmentId || "__none__";

    const designateMain = body.designateMain === true;
    const designateDefault = body.designateDefault === true;
    if ((designateMain || designateDefault) && !isMainDepartmentActor(auth)) {
      return NextResponse.json(
        { error: "Only the main company account can change which department is main or default" },
        { status: 403 },
      );
    }

    const wantsDetailUpdate =
      !!(body.label && String(body.label).trim()) ||
      !!body.country ||
      !!body.governorate ||
      !!body.delegation ||
      body.contactEmail !== undefined ||
      typeof body.latitude === "number" ||
      typeof body.longitude === "number" ||
      body.delegationId !== undefined ||
      body.postalCode !== undefined;

    if (!designateMain && !designateDefault && !wantsDetailUpdate) {
      return NextResponse.json({ error: "No changes requested" }, { status: 400 });
    }

    const db: any = prisma;

    await db.$transaction(async (tx: any) => {
      if (designateMain || designateDefault) {
        const exists = await tx.deliveryCompanyAddress.findFirst({
          where: { id: deptId, deliveryCompanyId: auth.companyId },
        });
        if (!exists) throw Object.assign(new Error("Department not found"), { status: 404 });
        if (designateMain) {
          await tx.deliveryCompanyAddress.updateMany({
            where: { deliveryCompanyId: auth.companyId },
            data: { isMainDepartment: false },
          });
          await tx.deliveryCompanyAddress.update({
            where: { id: deptId },
            data: { isMainDepartment: true },
          });
        }
        if (designateDefault) {
          await tx.deliveryCompanyAddress.updateMany({
            where: { deliveryCompanyId: auth.companyId },
            data: { isDefault: false },
          });
          await tx.deliveryCompanyAddress.update({
            where: { id: deptId },
            data: { isDefault: true },
          });
        }
      }

      if (wantsDetailUpdate) {
        const data: any = {};
        if (body.label && String(body.label).trim()) data.label = String(body.label).trim();
        if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail ? String(body.contactEmail).trim() : null;
        if (body.country) data.country = String(body.country);
        if (body.governorate) data.city = String(body.governorate);
        if (body.delegation) data.street = String(body.delegation);
        if (body.delegationId !== undefined) {
          data.delegationId =
            body.delegationId != null && String(body.delegationId).trim()
              ? String(body.delegationId).trim()
              : null;
        }
        if (body.postalCode !== undefined) {
          data.postalCode =
            body.postalCode != null && String(body.postalCode).trim() ? String(body.postalCode).trim() : null;
        }
        if (typeof body.latitude === "number") data.latitude = body.latitude;
        if (typeof body.longitude === "number") data.longitude = body.longitude;
        if (Object.keys(data).length > 0) {
          const updated = await tx.deliveryCompanyAddress.updateMany({ where, data });
          if (!updated.count) throw Object.assign(new Error("Department not found"), { status: 404 });
        }
      }
    });

    const auditDetails: Record<string, unknown> = { departmentId: deptId };
    if (designateMain) auditDetails.designateMain = true;
    if (designateDefault) auditDetails.designateDefault = true;
    await repairDepartmentMainDefaultInvariants(auth.companyId);
    await logCompanyAudit(
      auth.companyId,
      designateMain || designateDefault ? "DEPARTMENT_DESIGNATION_UPDATED" : "DEPARTMENT_UPDATED",
      "COMPANY",
      auth.departmentAccountId || auth.companyId,
      auditDetails,
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const status = e && typeof e === "object" && "status" in e ? (e as { status?: number }).status : undefined;
    if (status === 404) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : "Failed to update department";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
