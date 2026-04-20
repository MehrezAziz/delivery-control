import type { AdminPayload } from "@/lib/auth";
import { hasCSRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Governorates assigned to this CS user; empty array = no geographic scope (cannot see dept accounts). `"all"` = admin / no CS restriction. */
export async function getCsAllowedGovernorateIdsForDepartmentAccounts(
  auth: AdminPayload,
): Promise<string[] | "all"> {
  if (auth.role !== "CUSTOMER_SERVICE" || !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) return "all";
  const csId = auth.customerServiceId;
  if (!csId) return [];
  const scoped = await prisma.customerServiceGovernorate.findMany({
    where: { customerServiceId: csId },
    select: { governorateId: true },
  });
  return [...new Set(scoped.map((s) => s.governorateId))];
}

export async function assertCsCanAccessDepartmentAccount(
  auth: AdminPayload,
  companyId: string,
  accountId: string,
): Promise<void> {
  if (auth.role === "ADMIN") return;
  const allowed = await getCsAllowedGovernorateIdsForDepartmentAccounts(auth);
  if (allowed === "all") return;
  const db: any = prisma;
  const row = await db.deliveryCompanyDepartmentAccount.findFirst({
    where: { id: accountId, deliveryCompanyId: companyId },
    include: { department: { include: { delegation: { select: { governorateId: true } } } } },
  });
  if (!row) throw new Error("Department account not found");
  const gId = row.department?.delegation?.governorateId as string | undefined;
  if (!gId || !allowed.includes(gId)) {
    throw new Error("You do not have access to this department account");
  }
}
