import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function buildOrBranches(groupKeyRaw: string) {
  const key = (groupKeyRaw || "").trim();
  if (!key) return { error: "groupKey is required" as const };

  if (key.startsWith("singleton:")) {
    return { singletonId: key.slice("singleton:".length) } as const;
  }

  const colonIdx = key.indexOf(":");
  const isPrefixedThread =
    colonIdx > 0 &&
    ["order", "chat", "support", "dispute"].includes(key.slice(0, colonIdx).toLowerCase());

  const orBranches: Array<
    { groupKey: string } | { relatedEntityType: string; relatedEntityId: string }
  > = [{ groupKey: key }];
  if (!isPrefixedThread && colonIdx > 0) {
    const relatedEntityType = key.slice(0, colonIdx);
    const relatedEntityId = key.slice(colonIdx + 1);
    if (relatedEntityType && relatedEntityId) {
      orBranches.push({ relatedEntityType, relatedEntityId });
    }
  }

  return { orBranches } as const;
}

/** SUPER_USER (CS / admin): mark all unread rows in the same thread (e.g. `support:<ticketId>`). */
export async function PATCH(req: NextRequest) {
  const payload = await verifyToken();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = buildOrBranches(String(body?.groupKey ?? ""));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const now = new Date();
  const userId = payload.superUserId;

  if ("singletonId" in parsed) {
    const updated = await prisma.notification.updateMany({
      where: {
        id: parsed.singletonId,
        userType: "SUPER_USER",
        userId,
        readAt: null,
      },
      data: { readAt: now },
    });
    return NextResponse.json({ count: updated.count });
  }

  const updated = await prisma.notification.updateMany({
    where: {
      userType: "SUPER_USER",
      userId,
      readAt: null,
      OR: parsed.orBranches as any,
    },
    data: { readAt: now },
  });
  return NextResponse.json({ count: updated.count });
}
