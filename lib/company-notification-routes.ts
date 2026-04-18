import type { CompanyNotificationRow } from "./company-notification-types";

/**
 * Returns an in-app path for company notification rows, or null when no sensible route exists.
 */
export function getCompanyNotificationHref(n: CompanyNotificationRow): string | null {
  const type = n.type || "";
  const relT = n.relatedEntityType || "";
  const relId = n.relatedEntityId || "";

  const orderHrefWithChat = (orderId: string) => `/company/orders/${orderId}?chat=1`;

  if (relT === "BudgetRequest" && relId) {
    return `/company/budgets?highlightRequest=${encodeURIComponent(relId)}`;
  }
  if (relT === "RefundRequest" && relId) {
    return `/company/refunds?highlightRefund=${encodeURIComponent(relId)}`;
  }
  if (relT === "SupportTicket" && relId) {
    const withChat = type === "SUPPORT_TICKET_REPLY" ? "&chat=1" : "";
    return `/company/support?ticket=${encodeURIComponent(relId)}${withChat}`;
  }

  if (relT === "ChatRoom" && relId) {
    return orderHrefWithChat(relId);
  }

  if (relT === "Order" && relId) {
    if (type === "NEW_MESSAGE_FROM_DRIVER" || type === "NEW_MESSAGE_FROM_CUSTOMER") {
      return orderHrefWithChat(relId);
    }
    return `/company/orders/${relId}`;
  }

  if (type === "NEW_MESSAGE_FROM_DRIVER" || type === "NEW_MESSAGE_FROM_CUSTOMER") {
    const orderId =
      relId && (relT === "Order" || relT === "ChatRoom")
        ? relId
        : extractOrderIdFromChatGroupKey(n.groupKey);
    if (orderId) return orderHrefWithChat(orderId);
  }

  if (
    type === "SUPPORT_TICKET_REPLY" ||
    type === "SUPPORT_HUMAN_REQUESTED" ||
    type === "DISPUTE_REQUIRES_DECISION"
  ) {
    if (relT === "BudgetRequest") {
      return relId ? `/company/budgets?highlightRequest=${encodeURIComponent(relId)}` : "/company/budgets";
    }
    if (relT === "RefundRequest") {
      return relId ? `/company/refunds?highlightRefund=${encodeURIComponent(relId)}` : "/company/refunds";
    }
    if (relT === "SupportTicket" && relId) {
      return `/company/support?ticket=${encodeURIComponent(relId)}&chat=1`;
    }
    return "/company/support";
  }

  if (type === "REFUND_PROCESSED" && relT === "RefundRequest" && relId) {
    return `/company/refunds?highlightRefund=${encodeURIComponent(relId)}`;
  }

  return null;
}

function extractOrderIdFromChatGroupKey(groupKey?: string | null): string | null {
  const g = groupKey?.trim();
  if (!g) return null;
  const m = g.match(/^chat:([0-9a-f-]{36})$/i) || g.match(/^order:([0-9a-f-]{36})$/i);
  return m?.[1] ?? null;
}
