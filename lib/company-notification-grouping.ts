import type { CompanyInboxEntry, CompanyNotificationRow } from "./company-notification-types";

const CHAT_TYPES = new Set(["NEW_MESSAGE_FROM_DRIVER", "NEW_MESSAGE_FROM_CUSTOMER"]);

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

/**
 * Collapses multiple chat notifications for the same thread into one row with a count badge.
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

    const tk = companyChatThreadKey(n);
    if (!tk) {
      out.push({ kind: "single", notification: n, threadKey: null });
      continue;
    }

    const cluster = sorted.filter((r) => {
      if (!CHAT_TYPES.has(r.type || "")) return false;
      const k = companyChatThreadKey(r);
      return k === tk;
    });

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

  return out;
}
