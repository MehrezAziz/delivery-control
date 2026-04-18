import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor } from "@/lib/company-security";

/** Main company: full `delivery_company_transactions` ledger (main ↔ departments, orders, etc.). */
export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const rows = await prisma.deliveryCompanyTransaction.findMany({
      where: { deliveryCompanyId: auth.companyId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        description: true,
        orderId: true,
        createdAt: true,
      },
    });
    return NextResponse.json(
      rows.map((r) => ({
        ...r,
        amount: String(r.amount),
        balanceAfter: String(r.balanceAfter),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load ledger";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
