import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  const { key, value, category, description } = await req.json();

  const config = await prisma.systemConfig.create({
    data: { key, value, category, description, updatedBy: auth.superUserId },
  });

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "CREATE_SYSTEM_CONFIG",
    targetType: "SYSTEM_CONFIG",
    targetId: config.id,
    newValue: JSON.stringify({ key, value, category }),
  });

  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  const { id, value } = await req.json();

  const old = await prisma.systemConfig.findUnique({ where: { id } });
  if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = await prisma.systemConfig.update({
    where: { id },
    data: { value, updatedBy: auth.superUserId },
  });

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "UPDATE_SYSTEM_CONFIG",
    targetType: "SYSTEM_CONFIG",
    targetId: id,
    oldValue: old.value,
    newValue: value,
  });

  return NextResponse.json(config);
}
