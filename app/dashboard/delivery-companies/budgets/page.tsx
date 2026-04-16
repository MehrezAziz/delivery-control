"use client";

import { useEffect, useState } from "react";
import { buildIdempotencyKey } from "@/lib/idempotency";

type Row = {
  id: string;
  amountCoins: string | number;
  priority: string;
  status: string;
  createdAt: string;
  decisionNote?: string | null;
  deliveryCompany?: { name: string } | null;
  department?: { label: string; isMainDepartment?: boolean } | null;
};

export default function DeliveryCompanyBudgetsAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/delivery-companies/budget-requests");
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to load");
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    void load();
  }, []);

  const update = async (id: string, status: "APPROVED" | "REJECTED") => {
    const idemKey = buildIdempotencyKey("admin-deliverycompany-budget-decision", { id, status });
    const res = await fetch(`/api/delivery-companies/budget-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to update");
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Delivery Company Budget Requests</h1>
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.deliveryCompany?.name || "-"}</span>
              <span>{r.status}</span>
            </div>
            <p>
              {Number(r.amountCoins || 0).toFixed(2)} coins - {r.priority}
            </p>
            <p className="text-xs text-muted-foreground">
              Department: {r.department?.label || "-"} {r.department?.isMainDepartment ? "(Main)" : ""}
            </p>
            <p className="text-xs text-muted-foreground">{r.decisionNote || "-"}</p>
            {r.status === "PENDING" && (
              <div className="mt-2 flex gap-2">
                <button className="rounded-md border px-2 py-1 text-xs" onClick={() => update(r.id, "APPROVED")}>
                  Approve
                </button>
                <button className="rounded-md border px-2 py-1 text-xs" onClick={() => update(r.id, "REJECTED")}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
