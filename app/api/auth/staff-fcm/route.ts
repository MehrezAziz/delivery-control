import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PLATFORMS = new Set(["android", "ios", "web"]);

export async function GET() {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const su = await prisma.superUser.findUnique({
    where: { id: payload.superUserId },
    select: { fcmToken: true, fcmPlatform: true },
  });

  return NextResponse.json({
    registered: Boolean(su?.fcmToken),
    platform: su?.fcmPlatform ?? null,
  });
}

export async function POST(req: NextRequest) {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { token?: string | null; platform?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawToken = body.token;
  const token =
    rawToken === null || rawToken === undefined || rawToken === ""
      ? null
      : String(rawToken).trim() || null;

  if (!token) {
    await prisma.superUser.update({
      where: { id: payload.superUserId },
      data: { fcmToken: null, fcmPlatform: null },
    });
    return NextResponse.json({ ok: true, message: "Push token cleared" });
  }

  if (token.length > 4096) {
    return NextResponse.json({ error: "Token too long" }, { status: 400 });
  }

  const platform = body.platform ? String(body.platform).toLowerCase() : null;
  if (!platform || !PLATFORMS.has(platform)) {
    return NextResponse.json(
      { error: "platform is required when setting a token (android | ios | web)" },
      { status: 400 },
    );
  }

  // Same device token cannot be active on two staff accounts
  await prisma.superUser.updateMany({
    where: { fcmToken: token, id: { not: payload.superUserId } },
    data: { fcmToken: null, fcmPlatform: null },
  });

  await prisma.superUser.update({
    where: { id: payload.superUserId },
    data: { fcmToken: token, fcmPlatform: platform },
  });

  return NextResponse.json({ ok: true, message: "Push token saved" });
}
