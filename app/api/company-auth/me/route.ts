import { NextResponse } from "next/server";
import { verifyCompanyToken } from "@/lib/company-auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const payload = await verifyCompanyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cookieStore = await cookies();
  const token = cookieStore.get("company_token")?.value || null;
  const db: any = prisma;
  const company = await db.deliveryCompany.findUnique({
    where: { id: payload.companyId },
    select: { onboardingCompleted: true, contactEmail: true },
  });
  let departmentLabel: string | null = null;
  if (payload.departmentId) {
    const dept = await db.deliveryCompanyAddress.findFirst({
      where: { id: payload.departmentId, deliveryCompanyId: payload.companyId },
      select: { label: true },
    });
    departmentLabel = dept?.label ?? null;
  }
  return NextResponse.json({
    companyId: payload.companyId,
    companyName: payload.companyName,
    contactEmail: company?.contactEmail || null,
    onboardingCompleted: !!company?.onboardingCompleted,
    actorRole: payload.actorRole || "MAIN_ADMIN",
    departmentId: payload.departmentId || null,
    departmentAccountId: payload.departmentAccountId || null,
    departmentLabel,
    token,
  });
}
