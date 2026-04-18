/**
 * Persist + WebSocket dispatch for support ticket notifications via Nest NotificationsService
 * (delivery-control writes messages with Prisma directly, so Nest event listeners do not run).
 */

async function postControlPanel(path: string, ticketId: string): Promise<void> {
  const base = (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.DELIVERY_CONTROL_NOTIFY_SECRET;
  if (!secret) {
    console.warn(`[notify-support-ticket] DELIVERY_CONTROL_NOTIFY_SECRET missing; skip ${path}`);
    return;
  }
  try {
    const res = await fetch(`${base}/api/control-panel/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-delivery-control-secret": secret,
      },
      body: JSON.stringify({ ticketId }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[notify-support-ticket] ${path} failed`, res.status, t);
    }
  } catch (e) {
    console.error(`[notify-support-ticket] ${path} fetch error`, e);
  }
}

/** CS / admin sent a message — notify ticket owner (company inbox or customer user). */
export function notifySupportTicketReplyFromControlPanel(ticketId: string): void {
  void postControlPanel("support-notify-ticket-reply", ticketId);
}

/** Company (or end user) sent a message — notify customer service. */
export function notifySupportCustomerRepliedFromControlPanel(ticketId: string): void {
  void postControlPanel("support-notify-customer-replied", ticketId);
}

/** New ticket row persisted from delivery-control — same routing as Nest `support.new_ticket`. */
export function notifyNewSupportTicketFromControlPanel(ticketId: string): void {
  void postControlPanel("support-notify-new-ticket", ticketId);
}
