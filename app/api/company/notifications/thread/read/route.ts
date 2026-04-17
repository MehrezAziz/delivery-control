import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

function buildThreadOrBranches(groupKeyRaw: string) {
  const key = (groupKeyRaw || "").trim();
  if (!key) return { error: "groupKey is required" as const };

  if (key.startsWith("singleton:")) {
    return {
      singletonId: key.slice("singleton:".length),
    } as const;
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

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    const userIds = [auth.companyId, auth.departmentId, auth.departmentAccountId].filter(Boolean) as string[];
    const body = await req.json().catch(() => ({}));
    const groupKeyRaw = String(body?.groupKey ?? "");
    const parsed = buildThreadOrBranches(groupKeyRaw);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const now = new Date();

    if ("singletonId" in parsed) {
      const updated = await prisma.notification.updateMany({
        where: {
          id: parsed.singletonId,
          userType: "USER",
          userId: { in: userIds },
          readAt: null,
        },
        data: { readAt: now },
      });
      return NextResponse.json({ count: updated.count });
    }

    const updated = await prisma.notification.updateMany({
      where: {
        userType: "USER",
        userId: { in: userIds },
        readAt: null,
        OR: parsed.orBranches as any,
      },
      data: { readAt: now },
    });
    return NextResponse.json({ count: updated.count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to mark thread read";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
