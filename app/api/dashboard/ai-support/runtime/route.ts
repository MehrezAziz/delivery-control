import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

const CONFIG_KEY = "ai_support_enabled";

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  const body = await req.json();
  const enabled = Boolean(body?.enabled);

  const old = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });

  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    create: {
      key: CONFIG_KEY,
      value: enabled ? "true" : "false",
      category: "AI",
      description: "When false, AI assistant is off regardless of AI_SUPPORT_ENABLED (unless env is off).",
      updatedBy: auth.superUserId,
    },
    update: {
      value: enabled ? "true" : "false",
      updatedBy: auth.superUserId,
    },
  });

  try {
    await logAction({
      actorId: auth.superUserId,
      actorRole: "ADMIN",
      actionType: "UPDATE_AI_SUPPORT_RUNTIME",
      targetType: "SYSTEM_CONFIG",
      targetId: CONFIG_KEY,
      oldValue: old?.value ?? null,
      newValue: enabled ? "true" : "false",
    });
  } catch (e) {
    console.error("Failed to log action:", e);
  }

  return NextResponse.json({ ok: true, enabled });
}
