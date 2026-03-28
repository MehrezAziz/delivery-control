import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.notification.count({
    where: { userId: payload.superUserId, userType: "SUPER_USER", readAt: null },
  });

  return NextResponse.json({ count });
}
