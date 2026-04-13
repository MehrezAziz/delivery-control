import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Ask Nest API to send push+in-app ACCOUNT_SUSPENDED.
 * If webhook fails, create an IN_APP notification record directly as fallback.
 */
export async function notifyCustomerSuspended(userId: string): Promise<void> {
  const base = (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.DELIVERY_CONTROL_NOTIFY_SECRET;
  if (!secret) console.warn("[notify-customer-suspended] DELIVERY_CONTROL_NOTIFY_SECRET is not set; using DB fallback only");
  let deliveredByBackend = false;
  try {
    if (secret) {
      const res = await fetch(`${base}/api/control-panel/trigger-customer-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-delivery-control-secret": secret,
        },
        body: JSON.stringify({ userId, type: "ACCOUNT_SUSPENDED" }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("[notify-customer-suspended] backend error", res.status, t);
      } else {
        deliveredByBackend = true;
      }
    }
  } catch (e) {
    console.error("[notify-customer-suspended] fetch failed", e);
  }
  if (deliveredByBackend) return;

  // Fallback: at least persist an in-app notification so customer sees it.
  await prisma.notification.create({
    data: {
      userId,
      userType: "USER",
      type: NotificationType.ACCOUNT_SUSPENDED,
      priority: NotificationPriority.CRITICAL,
      channels: [NotificationChannel.IN_APP],
      title: "Account Suspended",
      body: "Your account has been suspended. Contact support for details.",
      deliveryStatus: NotificationDeliveryStatus.SENT,
    },
  });
}
