import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const status = searchParams.get("status");
  const skip = (page - 1) * limit;

  const where: any = { userId: payload.superUserId, userType: "SUPER_USER" };
  if (status === "read") where.readAt = { not: null };
  if (status === "unread") where.readAt = null;

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        priority: true,
        relatedEntityType: true,
        relatedEntityId: true,
        sentAt: true,
        readAt: true,
      },
    }),
    prisma.notification.count({ where }),
  ]);

  const data = rows.map((n) => ({
    ...n,
    title: n.title ?? "",
    body: n.body ?? "",
    sentAt: n.sentAt instanceof Date ? n.sentAt.toISOString() : String(n.sentAt),
    readAt: n.readAt ? (n.readAt instanceof Date ? n.readAt.toISOString() : String(n.readAt)) : null,
  }));

  return NextResponse.json({
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
