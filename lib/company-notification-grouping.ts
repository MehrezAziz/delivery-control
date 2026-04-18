import type { CompanyInboxEntry, CompanyNotificationRow } from "./company-notification-types";

const CHAT_TYPES = new Set(["NEW_MESSAGE_FROM_DRIVER", "NEW_MESSAGE_FROM_CUSTOMER"]);

const SUPPORT_INBOX_TYPES = new Set(["SUPPORT_TICKET_REPLY"]);

/** Same inbox thread key used when marking a chat thread read (`chat:<orderId>` or stored groupKey). */
export function companyChatThreadKey(n: CompanyNotificationRow): string | null {
  if (!n.type || !CHAT_TYPES.has(n.type)) return null;
  const g = n.groupKey?.trim();
  if (g) return g;
  const id = n.relatedEntityId;
  if (!id) return null;
  if (n.relatedEntityType === "Order" || n.relatedEntityType === "ChatRoom") return `chat:${id}`;
  return null;
}

/** CS → company user support replies: `support:<ticketId>` (same as `markThreadAsRead`). */
export function companySupportThreadKey(n: CompanyNotificationRow): string | null {
  if (!n.type || !SUPPORT_INBOX_TYPES.has(n.type)) return null;
  const g = n.groupKey?.trim();
  if (g?.startsWith("support:")) return g;
  if (n.relatedEntityType === "SupportTicket" && n.relatedEntityId) return `support:${n.relatedEntityId}`;
  return null;
}

function pushCluster(
  cluster: CompanyNotificationRow[],
  tk: string,
  out: CompanyInboxEntry[],
  used: Set<string>,
) {
  cluster.forEach((c) => used.add(c.id));
  const latest = cluster[0];
  const unreadCount = cluster.filter((c) => !c.readAt).length;
  if (cluster.length > 1) {
    out.push({
      kind: "group",
      threadKey: tk,
      notifications: cluster,
      latest,
      count: cluster.length,
      unreadCount,
    });
  } else {
    out.push({ kind: "single", notification: latest, threadKey: tk });
  }
}

/**
 * Collapses multiple chat notifications for the same thread into one row with a count badge.
 * Same for `SUPPORT_TICKET_REPLY` rows sharing `support:<ticketId>`.
 * Other notifications stay as single rows. Input must be sorted by `sentAt` desc (newest first).
 */
export function buildCompanyNotificationInbox(rows: CompanyNotificationRow[]): CompanyInboxEntry[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  const used = new Set<string>();
  const out: CompanyInboxEntry[] = [];

  for (const n of sorted) {
    if (used.has(n.id)) continue;

    const chatTk = companyChatThreadKey(n);
    if (chatTk) {
      const cluster = sorted.filter((r) => {
        if (!CHAT_TYPES.has(r.type || "")) return false;
        return companyChatThreadKey(r) === chatTk;
      });
      pushCluster(cluster, chatTk, out, used);
      continue;
    }

    const supTk = companySupportThreadKey(n);
    if (supTk) {
      const cluster = sorted.filter((r) => {
        if (!SUPPORT_INBOX_TYPES.has(r.type || "")) return false;
        return companySupportThreadKey(r) === supTk;
      });
      pushCluster(cluster, supTk, out, used);
      continue;
    }

    out.push({ kind: "single", notification: n, threadKey: null });
  }

  return out;
}

/** While the user is on `/company/orders/[orderId]`, hide chat message rows for that order in the bell preview. */
export function excludeChatNotificationsForOrder(
  rows: CompanyNotificationRow[],
  orderId: string | null | undefined,
): CompanyNotificationRow[] {
  if (!orderId) return rows;
  return rows.filter((n) => {
    if (!n.type || !CHAT_TYPES.has(n.type)) return true;
    const oid =
      n.relatedEntityType === "Order" || n.relatedEntityType === "ChatRoom"
        ? n.relatedEntityId
        : undefined;
    const gk = n.groupKey?.trim();
    const forThisOrder = oid === orderId || gk === `chat:${orderId}`;
    return !forThisOrder;
  });
}

/** While the user is viewing a support ticket thread, hide CS reply notifications for that ticket in the bell. */
export function excludeSupportNotificationsForTicket(
  rows: CompanyNotificationRow[],
  ticketId: string | null | undefined,
): CompanyNotificationRow[] {
  if (!ticketId) return rows;
  return rows.filter((n) => {
    if (!n.type || !SUPPORT_INBOX_TYPES.has(n.type)) return true;
    const tid =
      n.relatedEntityType === "SupportTicket" ? n.relatedEntityId : undefined;
    const gk = n.groupKey?.trim();
    const forThisTicket = tid === ticketId || gk === `support:${ticketId}`;
    return !forThisTicket;
  });
}
