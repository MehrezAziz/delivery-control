import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH() {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: payload.superUserId, userType: "SUPER_USER", readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ message: "All notifications marked as read" });
}
