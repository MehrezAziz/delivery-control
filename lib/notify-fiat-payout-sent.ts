/**
 * Tell Nest to push/in-app notify the end user after staff marks a fiat payout as sent
 * (delivery-control updates DB directly; Nest listeners do not run).
 */

export async function notifyUserFiatPayoutSent(payload: {
  userId: string;
  amount: string;
  currency: string;
  payoutMethod: "CASH" | "BANK_TRANSFER";
  withdrawalRequestId: string;
  relatedEntityType: "WithdrawalRequest" | "DriverWithdrawalRequest";
}): Promise<void> {
  const base = (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.DELIVERY_CONTROL_NOTIFY_SECRET;
  if (!secret) {
    console.warn("[notify-fiat-payout-sent] DELIVERY_CONTROL_NOTIFY_SECRET missing; skip user notify");
    return;
  }
  try {
    const res = await fetch(`${base}/api/control-panel/notify-fiat-payout-sent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-delivery-control-secret": secret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[notify-fiat-payout-sent] failed", res.status, t);
    }
  } catch (e) {
    console.error("[notify-fiat-payout-sent] fetch error", e);
  }
}
