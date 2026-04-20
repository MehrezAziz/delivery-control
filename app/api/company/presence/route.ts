import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { isMainDepartmentActor } from "@/lib/company-security";

/** Portal path for presence: department accounts on their row; main admin on `delivery_companies`. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path.trim().slice(0, 512) : "";
    const db: any = prisma;

    if (auth.departmentAccountId) {
      await db.deliveryCompanyDepartmentAccount.update({
        where: { id: auth.departmentAccountId },
        data: {
          portalPresencePath: path || null,
          portalPresenceAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (isMainDepartmentActor(auth)) {
      await db.deliveryCompany.update({
        where: { id: auth.companyId },
        data: {
          companyPortalPresencePath: path || null,
          companyPortalPresenceAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, skipped: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
