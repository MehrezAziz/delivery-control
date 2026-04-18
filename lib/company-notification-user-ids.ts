import { prisma } from "@/lib/prisma";
import type { CompanyPayload } from "@/lib/company-auth";

/**
 * Inbox scoping: each notification row has a single `userId` recipient.
 * - Main company (MAIN_ADMIN): only the company id + main department context — not every
 *   department/account, or main would see notifications targeted at department accounts.
 * - Department accounts: only their department + account ids — not `companyId`, or they would
 *   see the main company’s inbox (e.g. “new budget request” meant for main only).
 */
export async function getCompanyNotificationUserIds(auth: CompanyPayload): Promise<string[]> {
  const role = auth.actorRole || "MAIN_ADMIN";
  if (role === "MAIN_ADMIN") {
    return [...new Set([auth.companyId, auth.departmentId].filter(Boolean) as string[])];
  }
  return [...new Set([auth.departmentId, auth.departmentAccountId].filter(Boolean) as string[])];
}
