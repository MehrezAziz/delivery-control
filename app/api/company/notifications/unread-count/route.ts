import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { getCompanyNotificationUserIds } from "@/lib/company-notification-user-ids";

const CHAT_MESSAGE_TYPES = ["NEW_MESSAGE_FROM_DRIVER", "NEW_MESSAGE_FROM_CUSTOMER"] as const;

/** UUID v4 pattern for excludeChatOrderId */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    const userIds = await getCompanyNotificationUserIds(auth);
    const excludeChatOrderId = req.nextUrl.searchParams.get("excludeChatOrderId")?.trim() || "";
    const excludeOk = excludeChatOrderId.length > 0 && UUID_RE.test(excludeChatOrderId);

    const count = await prisma.notification.count({
      where: {
        userType: "USER",
        userId: { in: userIds },
        readAt: null,
        ...(excludeOk
          ? {
              NOT: {
                AND: [
                  { type: { in: [...CHAT_MESSAGE_TYPES] } },
                  {
                    OR: [
                      { groupKey: `chat:${excludeChatOrderId}` },
                      {
                        relatedEntityId: excludeChatOrderId,
                        relatedEntityType: { in: ["Order", "ChatRoom"] },
                      },
                    ],
                  },
                ],
              },
            }
          : {}),
      },
    });
    return NextResponse.json({ count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load unread count";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
