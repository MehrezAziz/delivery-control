import { prisma } from "@/lib/prisma";
import { CompanyPayload } from "@/lib/company-auth";

export async function ensureCompanyIsActive(companyId: string) {
  const db: any = prisma;
  const company = await db.deliveryCompany.findUnique({
    where: { id: companyId },
    select: { id: true, status: true },
  });
  if (!company) throw new Error("Company not found");
  if (company.status !== "ACTIVE") throw new Error("Company is not active");
  return company;
}

export async function ensureMainDepartmentExists(companyId: string) {
  const db: any = prisma;
  const mainDepartment = await db.deliveryCompanyAddress.findFirst({
    where: { deliveryCompanyId: companyId, isMainDepartment: true },
    select: { id: true },
  });
  if (mainDepartment) return mainDepartment.id;

  const fallback = await db.deliveryCompanyAddress.findFirst({
    where: { deliveryCompanyId: companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!fallback) throw new Error("Main department is not configured");

  await db.deliveryCompanyAddress.update({
    where: { id: fallback.id },
    data: { isMainDepartment: true, isDefault: true },
  });
  return fallback.id;
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
