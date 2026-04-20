import { prisma } from "@/lib/prisma";
import type { AdminPayload } from "@/lib/auth";
import { hasCSRole } from "@/lib/auth";

/**
 * Customer Service with `MANAGE_COMPANY_FINANCE` and at least one assigned governorate may only
 * act on companies whose **main** department has a `delegation` whose `governorateId` is in that set.
 * If the CS has no governorates assigned, no geographic restriction is applied (same as before).
 */
export async function assertCsFinanceCompanyScope(auth: AdminPayload, deliveryCompanyId: string): Promise<void> {
  if (auth.role !== "CUSTOMER_SERVICE" || !hasCSRole(auth, "MANAGE_COMPANY_FINANCE")) return;
  const csId = auth.customerServiceId;
  if (!csId) throw new Error("Missing customer service scope");

  const scoped = await prisma.customerServiceGovernorate.findMany({
    where: { customerServiceId: csId },
    select: { governorateId: true },
  });
  const allowedGovIds = [...new Set(scoped.map((s) => s.governorateId))];
  if (allowedGovIds.length === 0) return;

  const db: any = prisma;
  const main = await db.deliveryCompanyAddress.findFirst({
    where: { deliveryCompanyId, isMainDepartment: true },
    include: { delegation: { select: { governorateId: true } } },
  });
  const gId = main?.delegation?.governorateId as string | undefined;
  if (!main?.delegationId || !gId) {
    throw new Error("Company main department has no delegation — assign one before CS-scoped finance");
  }
  if (!allowedGovIds.includes(gId)) {
    throw new Error("You do not have access to this company's delegation");
  }
}

export async function filterDeliveryCompanyIdsForCsFinance(auth: AdminPayload): Promise<string[] | "all"> {
  if (auth.role !== "CUSTOMER_SERVICE" || !hasCSRole(auth, "MANAGE_COMPANY_FINANCE")) return "all";
  const csId = auth.customerServiceId;
  if (!csId) return "all";

  const scoped = await prisma.customerServiceGovernorate.findMany({
    where: { customerServiceId: csId },
    select: { governorateId: true },
  });
  const allowedGovIds = [...new Set(scoped.map((s) => s.governorateId))];
  if (allowedGovIds.length === 0) return "all";

  const db: any = prisma;
  const mains = (await db.deliveryCompanyAddress.findMany({
    where: {
      isMainDepartment: true,
      delegationId: { not: null },
      delegation: { governorateId: { in: allowedGovIds } },
    },
    select: { deliveryCompanyId: true },
  })) as { deliveryCompanyId: string }[];
  const ids = [...new Set(mains.map((m) => m.deliveryCompanyId))];
  /** If nothing matches (e.g. main departments have no `delegation_id` yet), do not hide every company in list UIs — writes are still blocked by `assertCsFinanceCompanyScope`. */
  if (ids.length === 0) return "all";
  return ids;
}
