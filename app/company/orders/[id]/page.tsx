"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Order = {
  id: string;
  status: string;
  createdAt: string;
  price?: string | number | null;
  description?: string | null;
  trackingToken?: string | null;
  driverAssignment?: {
    driverId?: string;
    arrivedAt?: string | null;
    pickedUpAt?: string | null;
    deliveredAt?: string | null;
    image1Proof?: string | null;
    image2Proof?: string | null;
  } | null;
  returnDepositFeedback?: {
    feedback: string;
    conditionIssue: boolean;
  } | null;
};

const ORDER_FLOW = ["SEARCHING_DRIVER", "DRIVER_ASSIGNED", "DRIVER_ARRIVED", "PICKED_UP", "DELIVERING", "RETURNED", "RETURN_DEPOSIT", "DELIVERED"];

export default function CompanyOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [feedback, setFeedback] = useState("");
  const [conditionIssue, setConditionIssue] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/company/orders");
      const data = await res.json();
      if (!res.ok) return setMessage(data?.error || "Failed to load order");
      const found = (Array.isArray(data) ? data : []).find((x: Order) => x.id === params.id) || null;
      setOrder(found);
      if (found?.returnDepositFeedback) {
        setFeedback(found.returnDepositFeedback.feedback || "");
        setConditionIssue(!!found.returnDepositFeedback.conditionIssue);
      }
    };
    void load();
  }, [params.id]);

  const currentStep = useMemo(() => {
    const idx = ORDER_FLOW.indexOf(order?.status || "");
    return idx >= 0 ? idx : 0;
  }, [order?.status]);

  const submitFeedback = async () => {
    const res = await fetch(`/api/company/orders/${params.id}/return-deposit-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback, conditionIssue }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to save feedback");
    setMessage("Feedback saved.");
  };

  if (!order) return <div className="text-sm text-muted-foreground">Loading order details...</div>;

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-lg border p-4">
        <h1 className="text-xl font-semibold">Order {order.id}</h1>
        <p className="text-sm text-muted-foreground">Status: {order.status}</p>
        <p className="text-sm text-muted-foreground">Price: {Number(order.price || 0).toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">Tracking: {order.trackingToken || "-"}</p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Timeline</h2>
        <div className="grid gap-2 md:grid-cols-4">
          {ORDER_FLOW.map((s, idx) => (
            <div
              key={s}
              className={`rounded-md border px-2 py-1 text-xs ${idx <= currentStep ? "bg-primary/10 border-primary" : ""}`}
            >
              {s}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Driver Info</h2>
        <p className="text-sm">Driver ID: {order.driverAssignment?.driverId || "-"}</p>
        <p className="text-sm">Arrived: {order.driverAssignment?.arrivedAt || "-"}</p>
        <p className="text-sm">Picked Up: {order.driverAssignment?.pickedUpAt || "-"}</p>
        <p className="text-sm">Delivered: {order.driverAssignment?.deliveredAt || "-"}</p>
        <p className="text-sm">Proof 1: {order.driverAssignment?.image1Proof ? "Uploaded" : "Missing"}</p>
        <p className="text-sm">Proof 2: {order.driverAssignment?.image2Proof ? "Uploaded" : "Optional"}</p>
      </section>

      {(order.status === "RETURNED" || order.status === "RETURN_DEPOSIT") && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Return Flow</h2>
          <p className="text-sm text-muted-foreground">
            Status moves from RETURNED to RETURN_DEPOSIT, then company submits feedback.
          </p>
          {order.status === "RETURN_DEPOSIT" && (
            <div className="mt-3 space-y-2">
              <textarea className="min-h-24 w-full rounded-md border px-3 py-2" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Describe return/deposit condition..." />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={conditionIssue} onChange={(e) => setConditionIssue(e.target.checked)} />
                Package condition issue
              </label>
              <button className="rounded-md border px-3 py-2 text-sm" onClick={submitFeedback}>
                Save Feedback
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
