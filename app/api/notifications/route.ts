import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const skip = (page - 1) * limit;

  const where: any = { userId: payload.superUserId, userType: "SUPER_USER" };
  if (status === "read") where.readAt = { not: null };
  if (status === "unread") where.readAt = null;

  const [data, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { sentAt: "desc" }, skip, take: limit }),
    prisma.notification.count({ where }),
  ]);

  return NextResponse.json({
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
