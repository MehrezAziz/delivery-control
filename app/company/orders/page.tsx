"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildIdempotencyKey } from "@/lib/idempotency";

type CompanyOrder = {
  id: string;
  status: string;
  price?: string | number | null;
  createdAt: string;
  sourceType?: string;
  description?: string | null;
  returnDepositFeedback?: { id: string; feedback: string; conditionIssue: boolean } | null;
};

type CompanyProfile = { addresses?: Array<{ id: string; label: string; isDefault?: boolean }> };

export default function CompanyOrdersPage() {
  const [orders, setOrders] = useState<CompanyOrder[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [pickupAddressId, setPickupAddressId] = useState("");
  const [dropoffAddressId, setDropoffAddressId] = useState("");
  const [localPickupOnly, setLocalPickupOnly] = useState(false);
  const [weight, setWeight] = useState("1");
  const [extraAmount, setExtraAmount] = useState("0");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [destinationMode, setDestinationMode] = useState<"address_id" | "manual">("address_id");
  const [destinationDetails, setDestinationDetails] = useState("");
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    totalPrice: number;
    reserveAmount: number;
    requiredCapacity: number;
    effectiveDiscountPercent: number;
  } | null>(null);
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [feedbackConditionIssue, setFeedbackConditionIssue] = useState<Record<string, boolean>>({});

  const load = async (keepLoading = false) => {
    if (!keepLoading) setLoading(true);
    try {
      const [profileRes, ordersRes] = await Promise.all([
        fetch("/api/company/profile").then((x) => x.json()),
        fetch("/api/company/orders").then((x) => x.json()),
      ]);
      setProfile(profileRes);
      if (!pickupAddressId && Array.isArray(profileRes?.addresses) && profileRes.addresses.length > 0) {
        const defaultDept = profileRes.addresses.find((a: { id: string; isDefault?: boolean }) => a.isDefault) || profileRes.addresses[0];
        if (defaultDept?.id) setPickupAddressId(defaultDept.id);
      }
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const payload = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      throw new Error("Customer name and phone are required");
    }
    if (!pickupAddressId) {
      throw new Error("Source delivery address is required");
    }
    if (!localPickupOnly && destinationMode === "address_id" && !dropoffAddressId) {
      throw new Error("Destination address ID is required");
    }

    const notes = [
      description?.trim() || "",
      `Customer: ${customerName.trim()}`,
      `Phone: ${customerPhone.trim()}`,
      destinationMode === "manual" && destinationDetails.trim() ? `Destination details: ${destinationDetails.trim()}` : "",
      "Source: Delivery company order",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      pickupAddressId,
      dropoffAddressId: localPickupOnly ? undefined : destinationMode === "address_id" ? dropoffAddressId : undefined,
    localPickupOnly,
    weight: Number(weight),
    customerExtraAmount: Number(extraAmount || 0),
      description: notes || undefined,
    };
  };

  const runPreview = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/company/orders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Preview failed");
      setPreview(data);
      setPreviewSignature(JSON.stringify(payload()));
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const createOrder = async () => {
    setMessage(null);
    try {
      const currentPayload = payload();
      if (!preview || previewSignature !== JSON.stringify(currentPayload)) {
        throw new Error("Preview is required before create. Please run preview after your latest changes.");
      }
      const idemKey = buildIdempotencyKey("company-orders-create", currentPayload);
      const res = await fetch("/api/company/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify(currentPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Order creation failed");
      setMessage("Order created successfully.");
      setPreview(null);
      setPreviewSignature(null);
      setDescription("");
      setCustomerName("");
      setCustomerPhone("");
      setDestinationDetails("");
      await load(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Order creation failed");
    }
  };

  const submitReturnFeedback = async (orderId: string) => {
    setMessage(null);
    try {
      const idemKey = buildIdempotencyKey("company-return-deposit-feedback", {
        orderId,
        feedback: feedbackText[orderId] || "",
        conditionIssue: !!feedbackConditionIssue[orderId],
      });
      const res = await fetch(`/api/company/orders/${orderId}/return-deposit-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({
          feedback: feedbackText[orderId] || "",
          conditionIssue: !!feedbackConditionIssue[orderId],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Feedback submission failed");
      setMessage("Return deposit feedback saved.");
      await load(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Feedback submission failed");
    }
  };

  if (loading) return <div>Loading orders...</div>;

  const statuses = Array.from(new Set(orders.map((o) => o.status)));
  const filteredOrders = orders.filter((o) => statusFilter === "ALL" || o.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCsv = () => {
    const lines = [
      "id,status,price,sourceType,description,createdAt",
      ...filteredOrders.map((o) =>
        [
          o.id,
          o.status,
          Number(o.price || 0).toFixed(2),
          o.sourceType || "",
          (o.description || "").replace(/"/g, '""'),
          o.createdAt,
        ]
          .map((v) => `"${String(v)}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "company-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Create Delivery Order</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="rounded-md border px-3 py-2"
            value={pickupAddressId}
            onChange={(e) => setPickupAddressId(e.target.value)}
          >
            <option value="">Select source department address</option>
            {(profile?.addresses || []).map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.label} ({addr.id.slice(0, 8)})
              </option>
            ))}
          </select>
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Customer full name (required)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Customer phone (required)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
          {!localPickupOnly && (
            <select
              className="rounded-md border px-3 py-2"
              value={destinationMode}
              onChange={(e) => setDestinationMode(e.target.value as "address_id" | "manual")}
            >
              <option value="address_id">Destination by address ID</option>
              <option value="manual">Destination by manual details</option>
            </select>
          )}
          {!localPickupOnly && destinationMode === "address_id" && (
            <input
              className="rounded-md border px-3 py-2"
              value={dropoffAddressId}
              onChange={(e) => setDropoffAddressId(e.target.value)}
              placeholder="Dropoff address ID"
            />
          )}
          {!localPickupOnly && destinationMode === "manual" && (
            <input
              className="rounded-md border px-3 py-2 md:col-span-2"
              value={destinationDetails}
              onChange={(e) => setDestinationDetails(e.target.value)}
              placeholder="Destination details (street/building/landmark)"
            />
          )}
          <input className="rounded-md border px-3 py-2" type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight" />
          <input className="rounded-md border px-3 py-2" type="number" min="0" step="0.1" value={extraAmount} onChange={(e) => setExtraAmount(e.target.value)} placeholder="Additional driver price (default 0)" />
        </div>
        <textarea className="mt-3 min-h-20 w-full rounded-md border px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={localPickupOnly} onChange={(e) => setLocalPickupOnly(e.target.checked)} />
          Local pickup only
        </label>
        <div className="mt-3 flex gap-2">
          <button className="rounded-md border px-3 py-2" onClick={runPreview}>
            Preview
          </button>
          <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={createOrder}>
            Create
          </button>
        </div>
        {preview && (
          <div className="mt-3 rounded-md border p-3 text-sm">
            <p>Total: {Number(preview.totalPrice || 0).toFixed(2)}</p>
            <p>Reserve: {Number(preview.reserveAmount || 0).toFixed(2)}</p>
            <p>Required Capacity: {Number(preview.requiredCapacity || 0).toFixed(2)}</p>
            <p>Discount: {Number(preview.effectiveDiscountPercent || 0).toFixed(2)}%</p>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Preview is mandatory before create. Drivers can identify this as a company order from order source metadata.
        </p>
      </section>

      <section className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Orders</h2>
          <select className="rounded-md border px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <div className="space-y-2">
          {pagedOrders.map((order) => (
            <div key={order.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{order.id}</span>
                <span>{order.status}</span>
              </div>
              <Link href={`/company/orders/${order.id}`} className="text-xs underline">Open details</Link>
              <p className="text-muted-foreground">
                Price: {Number(order.price || 0).toFixed(2)} | Source: {order.sourceType || "-"}
              </p>
              {order.status === "RETURN_DEPOSIT" && (
                <div className="mt-2 space-y-2 rounded-md border p-2">
                  <textarea
                    className="min-h-16 w-full rounded-md border px-2 py-1"
                    value={feedbackText[order.id] ?? order.returnDepositFeedback?.feedback ?? ""}
                    onChange={(e) => setFeedbackText((prev) => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Return deposit feedback"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={feedbackConditionIssue[order.id] ?? !!order.returnDepositFeedback?.conditionIssue}
                      onChange={(e) => setFeedbackConditionIssue((prev) => ({ ...prev, [order.id]: e.target.checked }))}
                    />
                    Condition issue
                  </label>
                  <button className="rounded-md border px-2 py-1 text-xs" onClick={() => submitReturnFeedback(order.id)}>
                    Save Feedback
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredOrders.length === 0 && <p className="text-sm text-muted-foreground">No orders found.</p>}
        </div>
        {filteredOrders.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>
              Page {currentPage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-2 py-1 disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="rounded-md border px-2 py-1 disabled:opacity-50"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
