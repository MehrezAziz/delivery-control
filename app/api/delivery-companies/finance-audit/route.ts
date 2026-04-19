import { NextRequest, NextResponse } from "next/server";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canViewFinanceAudit(auth: Awaited<ReturnType<typeof requireAuth>>): boolean {
  if (auth.role === "ADMIN") return true;
  return (
    auth.role === "CUSTOMER_SERVICE" &&
    hasCSRole(auth, "SEE_DELIVERY_COMPANY") &&
    hasCSRole(auth, "MANAGE_COMPANY_FINANCE")
  );
}

/** GET — recent company finance adjustments from audit log (optionally filter by company). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!canViewFinanceAudit(auth)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const companyId = req.nextUrl.searchParams.get("deliveryCompanyId")?.trim();
    const take = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("take") || 50)));

    const db: any = prisma;
    const rows = await db.deliveryCompanyAuditLog.findMany({
      where: {
        actionType: "COMPANY_FINANCE_ADJUSTED",
        ...(companyId ? { deliveryCompanyId: companyId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        deliveryCompany: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = /unauthorized/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
