import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.notification.updateMany({
    where: { id, userId: payload.superUserId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ message: "Notification marked as read" });
}
