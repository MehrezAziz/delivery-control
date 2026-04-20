import { prisma } from "@/lib/prisma";
import type { CompanyPayload } from "@/lib/company-auth";
import { isMainDepartmentActor } from "@/lib/company-security";

/**
 * When true, the company portal viewer is on the orders area (list, detail, or sub-routes under an order id).
 * Used only to suppress the redundant in-app "new company order" row for that tab at the moment of create.
 */
export function isViewerOnCompanyOrdersChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.split("?")[0].replace(/\/$/, "") || "/";
  if (p === "/company/orders") return true;
  return /^\/company\/orders\/[0-9a-f-]{36}(\/.*)?$/i.test(p);
}

/**
 * Main company inbox "new company order" applies when the order is placed as main admin
 * or by a department account on the **main department** (same billing context as main company wallet).
 */
export async function shouldNotifyMainCompanyInboxForNewOrder(auth: CompanyPayload): Promise<boolean> {
  if (isMainDepartmentActor(auth)) return true;
  const deptId = auth.departmentId;
  if (!deptId) return false;
  const row = await prisma.deliveryCompanyAddress.findFirst({
    where: { id: deptId, deliveryCompanyId: auth.companyId },
    select: { isMainDepartment: true },
  });
  return !!row?.isMainDepartment;
}
