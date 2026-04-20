import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

/** Department account users report their current portal path so the backend can skip redundant push when they are already on Orders. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    const accountId = auth.departmentAccountId;
    if (!accountId) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path.trim().slice(0, 512) : "";
    const db: any = prisma;
    await db.deliveryCompanyDepartmentAccount.update({
      where: { id: accountId },
      data: {
        portalPresencePath: path || null,
        portalPresenceAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
