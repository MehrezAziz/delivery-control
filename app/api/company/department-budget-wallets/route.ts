import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyIsActive, ensureMainDepartmentActor } from "@/lib/company-security";

/** Main company: each department’s budget wallet (child departments). */
export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureMainDepartmentActor(auth);
    const db: any = prisma;
    const rows = await db.deliveryCompanyDepartmentBudgetWallet.findMany({
      where: { deliveryCompanyId: auth.companyId },
      orderBy: { updatedAt: "desc" },
      include: {
        department: { select: { id: true, label: true, isMainDepartment: true } },
      },
    });
    return NextResponse.json(
      rows.map((r: any) => ({
        ...r,
        availableCoins: String(r.availableCoins),
        lockedCoins: String(r.lockedCoins),
      })),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load department wallets";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
