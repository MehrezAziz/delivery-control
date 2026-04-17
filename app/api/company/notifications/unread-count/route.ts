import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    const userIds = [auth.companyId, auth.departmentId, auth.departmentAccountId].filter(Boolean) as string[];
    const count = await prisma.notification.count({
      where: { userType: "USER", userId: { in: userIds }, readAt: null },
    });
    return NextResponse.json({ count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load unread count";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
