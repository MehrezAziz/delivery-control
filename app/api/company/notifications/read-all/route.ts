import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

export async function PATCH() {
  try {
    const auth = await requireCompanyAuth();
    const userIds = [auth.companyId, auth.departmentId, auth.departmentAccountId].filter(Boolean) as string[];
    await prisma.notification.updateMany({
      where: { userType: "USER", userId: { in: userIds }, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to mark all read";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
