import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    const { id } = await params;
    const userIds = [auth.companyId, auth.departmentId, auth.departmentAccountId].filter(Boolean) as string[];
    const updated = await prisma.notification.updateMany({
      where: { id, userType: "USER", userId: { in: userIds }, readAt: null },
      data: { readAt: new Date() },
    });
    if (!updated.count) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to mark notification";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
