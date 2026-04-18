import { prisma } from "@/lib/prisma";
import type { CompanyPayload } from "@/lib/company-auth";

/**
 * Notifications for delivery companies use `user_id` = `deliveryCompanyId` or a
 * department address id (`targetCompanyUserId` in the backend). The JWT only stores
 * one `departmentId` (main dept for company login), so **main admins** must match every
 * department id or read/count APIs miss rows stored under a child department.
 * Department-scoped accounts keep the narrower id list so they do not see other depts.
 */
export async function getCompanyNotificationUserIds(auth: CompanyPayload): Promise<string[]> {
  const base = [auth.companyId, auth.departmentId, auth.departmentAccountId].filter(Boolean) as string[];
  const role = auth.actorRole || "MAIN_ADMIN";
  if (role === "MAIN_ADMIN") {
    const depts = await prisma.deliveryCompanyAddress.findMany({
      where: { deliveryCompanyId: auth.companyId },
      select: { id: true },
    });
    return [...new Set([...base, ...depts.map((d) => d.id)])];
  }
  return [...new Set(base)];
}
