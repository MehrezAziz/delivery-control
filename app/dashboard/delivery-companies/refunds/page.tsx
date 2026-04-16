"use client";

import { useEffect, useState } from "react";

type Refund = {
  id: string;
  amountCoins: string | number;
  status: string;
  reason?: string | null;
  createdAt: string;
  deliveryCompany?: { name: string } | null;
};

export default function DeliveryCompanyRefundsAdminPage() {
  const [rows, setRows] = useState<Refund[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/delivery-companies/refund-requests");
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to load");
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    void load();
  }, []);

  const update = async (id: string, status: string) => {
    const res = await fetch(`/api/delivery-companies/refund-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to update");
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Delivery Company Refunds</h1>
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.deliveryCompany?.name || "-"}</span>
              <span>{r.status}</span>
            </div>
            <p>{Number(r.amountCoins || 0).toFixed(2)} coins</p>
            <p className="text-xs text-muted-foreground">{r.reason || "-"}</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded-md border px-2 py-1 text-xs" onClick={() => update(r.id, "APPROVED")}>Approve</button>
              <button className="rounded-md border px-2 py-1 text-xs" onClick={() => update(r.id, "REJECTED")}>Reject</button>
              <button className="rounded-md border px-2 py-1 text-xs" onClick={() => update(r.id, "PAID")}>Mark Paid</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
