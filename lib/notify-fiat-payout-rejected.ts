export async function notifyUserFiatPayoutRejected(payload: {
  userId: string;
  amount: string;
  reason: string;
  withdrawalRequestId: string;
  relatedEntityType: "WithdrawalRequest" | "DriverWithdrawalRequest";
}): Promise<void> {
  const base = (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.DELIVERY_CONTROL_NOTIFY_SECRET;
  if (!secret) {
    console.warn("[notify-fiat-payout-rejected] DELIVERY_CONTROL_NOTIFY_SECRET missing; skip user notify");
    return;
  }
  try {
    const res = await fetch(`${base}/api/control-panel/notify-fiat-payout-rejected`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-delivery-control-secret": secret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[notify-fiat-payout-rejected] failed", res.status, t);
    }
  } catch (e) {
    console.error("[notify-fiat-payout-rejected] fetch error", e);
  }
}
