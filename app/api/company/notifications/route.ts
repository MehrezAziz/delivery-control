import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { getCompanyNotificationUserIds } from "@/lib/company-notification-user-ids";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "20")));
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const skip = (page - 1) * limit;
    const userIds = await getCompanyNotificationUserIds(auth);
    const rows = await prisma.notification.findMany({
      where: { userType: "USER", userId: { in: userIds } },
      orderBy: { sentAt: "desc" },
      take: limit,
      skip,
    });
    return NextResponse.json(rows);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load notifications";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
