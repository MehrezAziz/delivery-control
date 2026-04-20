import { prisma } from "@/lib/prisma";
import { CompanyPayload } from "@/lib/company-auth";

/** Company may call operational APIs: not suspended, and main department with delegation exists. */
export async function ensureCompanyOperational(companyId: string) {
  const db: any = prisma;
  const company = await db.deliveryCompany.findUnique({
    where: { id: companyId },
    select: { id: true, status: true },
  });
  if (!company) throw new Error("Company not found");
  if (company.status === "SUSPENDED") throw new Error("Company is suspended");
  /**
   * Main and default may be the same `delivery_company_addresses` row or two different rows.
   * Do not require `delegationId` on the `isMainDepartment` row only — the default row may hold
   * governorate/delegation while the main row is address-only; both are "anchor" departments.
   */
  const anchorWithDelegation = await db.deliveryCompanyAddress.findFirst({
    where: {
      deliveryCompanyId: companyId,
      delegationId: { not: null },
      OR: [{ isMainDepartment: true }, { isDefault: true }],
    },
    select: { id: true },
  });
  if (!anchorWithDelegation) {
    throw new Error(
      "Set country, governorate, and delegation on your main or default department before using this feature.",
    );
  }
  return company;
}

/** @deprecated Use ensureCompanyOperational — name kept for call sites. */
export async function ensureCompanyIsActive(companyId: string) {
  return ensureCompanyOperational(companyId);
}

/** Ensures exactly one `isMainDepartment` and one `isDefault` per company (can be the same row or two different rows). */
export async function repairDepartmentMainDefaultInvariants(companyId: string) {
  const db: any = prisma;
  await db.$transaction(async (tx: any) => {
    const rows = await tx.deliveryCompanyAddress.findMany({
      where: { deliveryCompanyId: companyId },
      orderBy: { createdAt: "asc" },
    });
    if (rows.length === 0) return;

    const mainTagged = rows.filter((r: { isMainDepartment: boolean }) => r.isMainDepartment);
    let mainId: string;
    if (mainTagged.length === 1) mainId = mainTagged[0].id;
    else if (mainTagged.length === 0) mainId = rows[0].id;
    else mainId = mainTagged[0].id;

    const defaultTagged = rows.filter((r: { isDefault: boolean }) => r.isDefault);
    let defaultId: string;
    if (defaultTagged.length === 1) defaultId = defaultTagged[0].id;
    else if (defaultTagged.length === 0) defaultId = mainId;
    else defaultId = defaultTagged[0].id;

    await tx.deliveryCompanyAddress.updateMany({
      where: { deliveryCompanyId: companyId },
      data: { isMainDepartment: false, isDefault: false },
    });
    await tx.deliveryCompanyAddress.update({
      where: { id: mainId },
      data: {
        isMainDepartment: true,
        ...(mainId === defaultId ? { isDefault: true } : { isDefault: false }),
      },
    });
    if (mainId !== defaultId) {
      await tx.deliveryCompanyAddress.update({
        where: { id: defaultId },
        data: { isDefault: true },
      });
    }
  });
}

export async function ensureMainDepartmentExists(companyId: string) {
  const db: any = prisma;
  const count = await db.deliveryCompanyAddress.count({ where: { deliveryCompanyId: companyId } });
  if (count === 0) throw new Error("Main department is not configured");
  await repairDepartmentMainDefaultInvariants(companyId);
  const mainDepartment = await db.deliveryCompanyAddress.findFirst({
    where: { deliveryCompanyId: companyId, isMainDepartment: true },
    select: { id: true },
  });
  if (!mainDepartment) throw new Error("Main department is not configured");
  return mainDepartment.id;
}

export function ensureMainDepartmentActor(payload: CompanyPayload) {
  if ((payload.actorRole || "MAIN_ADMIN") !== "MAIN_ADMIN") {
    throw new Error("This action is restricted to the main department");
  }
}

export function isMainDepartmentActor(payload: CompanyPayload) {
  return (payload.actorRole || "MAIN_ADMIN") === "MAIN_ADMIN";
}

export function ensureCompanyRoleAllowed(
  payload: CompanyPayload,
  roles: Array<"MAIN_ADMIN" | "DEPT_ADMIN" | "DEPT_OPERATOR" | "DEPT_VIEWER">,
) {
  const role = payload.actorRole || "MAIN_ADMIN";
  if (!roles.includes(role)) {
    throw new Error(`Role ${role} is not allowed for this action`);
  }
}

export async function logCompanyAudit(
  companyId: string,
  actionType: string,
  actorType: string,
  actorRef?: string | null,
  details?: Record<string, unknown>,
) {
  const db: any = prisma;
  try {
    await db.deliveryCompanyAuditLog.create({
      data: {
        deliveryCompanyId: companyId,
        actionType,
        actorType,
        actorRef: actorRef ?? null,
        details: details ?? undefined,
      },
    });
  } catch {
    // non-blocking audit to keep API resilient
  }
}
