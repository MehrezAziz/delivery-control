import { NextResponse } from "next/server";
import { verifyCompanyToken } from "@/lib/company-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const payload = await verifyCompanyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db: any = prisma;
  const company = await db.deliveryCompany.findUnique({
    where: { id: payload.companyId },
    select: { onboardingCompleted: true, contactEmail: true },
  });
  return NextResponse.json({
    companyId: payload.companyId,
    companyName: payload.companyName,
    contactEmail: company?.contactEmail || null,
    onboardingCompleted: !!company?.onboardingCompleted,
  });
}
