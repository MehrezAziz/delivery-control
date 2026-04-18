/**
 * Customer Service (`/cs`) notification bell + full list: group repeated “same thread” rows
 * (order chat, support ticket replies) so the bar is not one row per message.
 */

export const CS_BELL_GROUP_BY_TYPE = new Set(["NEW_SUPPORT_TICKET", "NEW_ORDER_FOR_CUSTOMER_SERVICE"]);

const CHAT_TYPES = new Set(["NEW_MESSAGE_FROM_DRIVER", "NEW_MESSAGE_FROM_CUSTOMER"]);

const SUPPORT_THREAD_TYPES = new Set(["SUPPORT_TICKET_REPLY", "CUSTOMER_REPLIED_TICKET"]);

export type CsBellNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  groupKey?: string | null;
  sentAt: string;
  readAt: string | null;
};

export type CsDisplayNotification = CsBellNotification & {
  groupCount?: number;
  groupedIds?: string[];
};

/** Stable thread key for order chat (`chat:<orderId>`) or support ticket (`support:<ticketId>`). */
export function csNotificationThreadKey(n: CsBellNotification): string | null {
  const t = n.type || "";
  if (CHAT_TYPES.has(t)) {
    const g = n.groupKey?.trim();
    if (g) return g;
    const id = n.relatedEntityId;
    if (!id) return null;
    if (n.relatedEntityType === "Order" || n.relatedEntityType === "ChatRoom") return `chat:${id}`;
    return null;
  }
  if (SUPPORT_THREAD_TYPES.has(t) && n.relatedEntityType === "SupportTicket" && n.relatedEntityId) {
    return `support:${n.relatedEntityId}`;
  }
  const g = n.groupKey?.trim();
  if (g?.startsWith("support:")) return g;
  return null;
}

/**
 * - Unread-only groups for `NEW_SUPPORT_TICKET` / `NEW_ORDER_FOR_CUSTOMER_SERVICE` (same as before).
 * - Merges all rows in the same chat or support thread (read + unread) into one row with a count badge.
 */
/** While CS is viewing `/cs/support/[ticketId]`, hide in-app rows for new company replies on that ticket. */
export function excludeCsSupportTicketWhenViewing(
  rows: CsBellNotification[],
  activeTicketId: string | null | undefined,
): CsBellNotification[] {
  if (!activeTicketId) return rows;
  return rows.filter((n) => {
    if (n.type !== "CUSTOMER_REPLIED_TICKET") return true;
    const tid = n.relatedEntityType === "SupportTicket" ? n.relatedEntityId : null;
    return tid !== activeTicketId;
  });
}

export function buildCsDisplayNotifications(rows: CsBellNotification[]): CsDisplayNotification[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  const used = new Set<string>();
  const out: CsDisplayNotification[] = [];

  for (const n of sorted) {
    if (used.has(n.id)) continue;

    if (!n.readAt && CS_BELL_GROUP_BY_TYPE.has(n.type)) {
      const cluster = sorted.filter((r) => !r.readAt && r.type === n.type && !used.has(r.id));
      cluster.forEach((c) => used.add(c.id));
      if (cluster.length === 0) continue;
      const latest = cluster[0];
      if (cluster.length === 1) {
        out.push(latest);
      } else {
        out.push({
          ...latest,
          groupCount: cluster.length,
          groupedIds: cluster.map((c) => c.id),
        });
      }
      continue;
    }

    const tk = csNotificationThreadKey(n);
    if (tk) {
      const cluster = sorted.filter((r) => !used.has(r.id) && csNotificationThreadKey(r) === tk);
      cluster.forEach((c) => used.add(c.id));
      if (cluster.length === 0) continue;
      const latest = cluster[0];
      const allRead = cluster.every((c) => c.readAt);
      if (cluster.length === 1) {
        out.push(latest);
      } else {
        out.push({
          ...latest,
          readAt: allRead ? latest.readAt : null,
          groupCount: cluster.length,
          groupedIds: cluster.map((c) => c.id),
        });
      }
      continue;
    }

    out.push(n);
  }

  return out.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}
