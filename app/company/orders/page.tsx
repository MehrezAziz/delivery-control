"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { connectSocket, getSocket } from "@/lib/socket";

type CompanyOrder = {
  id: string;
  status: string;
  price?: string | number | null;
  cancelAfterMinutes?: number | null;
  cancelRemainingSeconds?: number | null;
  cancelTimerLastResumedAt?: string | null;
  createdAt: string;
  sourceType?: string;
  description?: string | null;
  returnDepositFeedback?: { id: string; feedback: string; conditionIssue: boolean } | null;
};

type CompanyProfile = {
  addresses?: Array<{
    id: string;
    label: string;
    isDefault?: boolean;
    country?: string | null;
    city?: string | null;
    street?: string | null;
  }>;
  actorRole?: "MAIN_ADMIN" | "DEPT_ADMIN" | "DEPT_OPERATOR" | "DEPT_VIEWER";
  departmentId?: string | null;
};
type GeoTree = {
  countries: Array<{
    id: string;
    name: string;
    governorates: Array<{
      id: string;
      nameGovernorate: string;
      delegations: Array<{ id: string; nameDelegation: string }>;
    }>;
  }>;
};

function formatSearchingRemain(o: CompanyOrder): string {
  if (o.status !== "SEARCHING_DRIVER") return "";
  const base =
    typeof o.cancelRemainingSeconds === "number"
      ? o.cancelRemainingSeconds
      : Math.max(0, Number(o.cancelAfterMinutes ?? 15) * 60);
  const last = o.cancelTimerLastResumedAt ? new Date(o.cancelTimerLastResumedAt).getTime() : null;
  const sec = last ? Math.max(0, base - Math.floor((Date.now() - last) / 1000)) : base;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function FieldLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default function CompanyOrdersPage() {
  const [orders, setOrders] = useState<CompanyOrder[]>([]);
  const [listTick, setListTick] = useState(0);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [pickupAddressId, setPickupAddressId] = useState("");
  const [localPickupOnly, setLocalPickupOnly] = useState(false);
  const [weight, setWeight] = useState("1");
  const [maxConfirmationDelayMinutes, setMaxConfirmationDelayMinutes] = useState("15");
  const [extraAmount, setExtraAmount] = useState("0");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dropoffGovernorateId, setDropoffGovernorateId] = useState("");
  const [dropoffDelegationId, setDropoffDelegationId] = useState("");
  const [dropoffStreet, setDropoffStreet] = useState("");
  const [geo, setGeo] = useState<GeoTree>({ countries: [] });
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    totalPrice: number;
    reserveAmount: number;
    requiredCapacity: number;
    effectiveDiscountPercent: number;
    calculatedPrice: number;
    discountedPrice: number;
    customerExtraAmount: number;
    weightKg: number;
    distanceKm: number;
    billingDistanceKm: number;
    pricePerKm: number;
    nightFee: number;
    maxConfirmationDelayMinutes: number;
  } | null>(null);
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [feedbackConditionIssue, setFeedbackConditionIssue] = useState<Record<string, boolean>>({});
  const [addDelayMinutesByOrder, setAddDelayMinutesByOrder] = useState<Record<string, string>>({});
  const isChildDepartment = !!profile?.actorRole && profile.actorRole !== "MAIN_ADMIN";
  const selectedPickupAddress = (profile?.addresses || []).find((a) => a.id === pickupAddressId) || null;
  const pickupCountry = geo.countries.find(
    (c) =>
      c.name.toLowerCase() === String(selectedPickupAddress?.country || "").toLowerCase() ||
      c.name.toLowerCase() === String(selectedPickupAddress?.country || "").trim().toLowerCase(),
  ) || null;
  const governorates = pickupCountry?.governorates || [];
  const selectedGovernorate = governorates.find((g) => g.id === dropoffGovernorateId) || null;
  const delegations = selectedGovernorate?.delegations || [];
  const money = (value: number) => `${Number(value || 0).toFixed(2)} coins`;

  const loadRef = useRef<((keepLoading?: boolean) => Promise<void>) | null>(null);
  const load = async (keepLoading = false) => {
    if (!keepLoading) setLoading(true);
    try {
      const [profileRes, ordersRes] = await Promise.all([
        fetch("/api/company/profile").then((x) => x.json()),
        fetch("/api/company/orders").then((x) => x.json()),
      ]);
      const geoRes = await fetch("/api/company/geo").then((x) => x.json()).catch(() => ({ countries: [] }));
      setProfile(profileRes);
      setGeo({ countries: Array.isArray(geoRes?.countries) ? geoRes.countries : [] });
      if (Array.isArray(profileRes?.addresses) && profileRes.addresses.length > 0) {
        const actorRole = profileRes?.actorRole as string | undefined;
        const isChild = !!actorRole && actorRole !== "MAIN_ADMIN";
        const childDepartmentId = profileRes?.departmentId as string | undefined;
        const childAddress =
          isChild && childDepartmentId
            ? profileRes.addresses.find((a: { id: string }) => a.id === childDepartmentId)
            : null;
        const defaultDept =
          childAddress ||
          profileRes.addresses.find((a: { id: string; isDefault?: boolean }) => a.isDefault) ||
          profileRes.addresses[0];
        if (defaultDept?.id) setPickupAddressId(defaultDept.id);
      } else if (!pickupAddressId) {
        setPickupAddressId("");
      }
      setOrders(Array.isArray(ordersRes) ? ordersRes : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  };
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => void loadRef.current?.(true);
    async function initSocket() {
      try {
        const meRes = await fetch("/api/company-auth/me", { cache: "no-store" });
        if (!meRes.ok || cancelled) return;
        const me = await meRes.json();
        if (!me?.token || cancelled) return;
        const socket = connectSocket(String(me.token));
        socket.on("notification", refresh);
        socket.on("order_chat_refresh", refresh);
      } catch {
        /* ignore */
      }
    }
    void initSocket();
    return () => {
      cancelled = true;
      const s = getSocket();
      s?.off("notification", refresh);
      s?.off("order_chat_refresh", refresh);
    };
  }, []);

  useEffect(() => {
    // Fallback realtime channel: keeps statuses fresh even if socket reconnect/auth briefly fails.
    const interval = setInterval(() => {
      void loadRef.current?.(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    const searching = orders.some((o) => o.status === "SEARCHING_DRIVER");
    if (!searching) return;
    const id = setInterval(() => setListTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [orders]);

  useEffect(() => {
    if (!selectedPickupAddress || !governorates.length) return;
    if (dropoffGovernorateId) return;
    const match = governorates.find(
      (g) => g.nameGovernorate.toLowerCase() === String(selectedPickupAddress.city || "").toLowerCase(),
    );
    if (match) setDropoffGovernorateId(match.id);
  }, [pickupAddressId, selectedPickupAddress, governorates, dropoffGovernorateId]);

  useEffect(() => {
    if (!dropoffGovernorateId) {
      setDropoffDelegationId("");
      return;
    }
    if (!delegations.some((d) => d.id === dropoffDelegationId)) {
      setDropoffDelegationId("");
    }
  }, [dropoffGovernorateId, delegations, dropoffDelegationId]);

  const payload = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      throw new Error("Customer name and phone are required");
    }
    if (!localPickupOnly && !dropoffGovernorateId) {
      throw new Error("Destination governorate is required");
    }
    if (!localPickupOnly && !dropoffDelegationId) {
      throw new Error("Destination delegation is required");
    }

    const notes = [
      description?.trim() || "",
      `Customer: ${customerName.trim()}`,
      `Phone: ${customerPhone.trim()}`,
      dropoffStreet.trim() ? `Destination street: ${dropoffStreet.trim()}` : "",
      "Source: Delivery company order",
    ]
      .filter(Boolean)
      .join("\n");

    const resolvedPickupAddressId =
      isChildDepartment && profile?.departmentId ? profile.departmentId : pickupAddressId;
    if (!resolvedPickupAddressId) {
      throw new Error("Source delivery address is required");
    }

    return {
      pickupAddressId: resolvedPickupAddressId,
      dropoffAddressId: undefined,
      dropoffGovernorateId: localPickupOnly ? undefined : dropoffGovernorateId,
      dropoffDelegationId: localPickupOnly ? undefined : dropoffDelegationId,
      dropoffStreet: localPickupOnly ? undefined : dropoffStreet.trim() || undefined,
      localPickupOnly,
      weight: Number(weight),
      maxConfirmationDelayMinutes: Number(maxConfirmationDelayMinutes || 15),
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
      setDropoffStreet("");
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

  const addConfirmationDelay = async (orderId: string) => {
    setMessage(null);
    try {
      const minutesToAdd = Number(addDelayMinutesByOrder[orderId] || "0");
      if (!Number.isFinite(minutesToAdd) || minutesToAdd < 1) {
        throw new Error("Please enter minutes to add (minimum 1).");
      }
      const res = await fetch(`/api/company/orders/${orderId}/add-confirmation-delay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutesToAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || "Failed to add confirmation delay");
      setMessage(`Added ${minutesToAdd} minutes to order confirmation delay.`);
      setAddDelayMinutesByOrder((prev) => ({ ...prev, [orderId]: "15" }));
      await load(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to add confirmation delay");
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

      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Create Delivery Order</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldLine label="Source department (pickup)">
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
              value={pickupAddressId}
              onChange={(e) => setPickupAddressId(e.target.value)}
              disabled={isChildDepartment}
            >
              <option value="">{isChildDepartment ? "Your department source address" : "Select department"}</option>
              {(isChildDepartment
                ? (profile?.addresses || []).filter((addr) => addr.id === profile?.departmentId)
                : profile?.addresses || []
              ).map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.label} ({addr.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </FieldLine>
          <FieldLine label="Customer full name">
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </FieldLine>
          <FieldLine label="Customer phone">
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </FieldLine>
          {!localPickupOnly && (
            <FieldLine label="Destination governorate">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
                value={dropoffGovernorateId}
                onChange={(e) => setDropoffGovernorateId(e.target.value)}
              >
                <option value="">Select governorate</option>
                {governorates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nameGovernorate}
                  </option>
                ))}
              </select>
            </FieldLine>
          )}
          {!localPickupOnly && (
            <FieldLine label="Destination delegation">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
                value={dropoffDelegationId}
                onChange={(e) => setDropoffDelegationId(e.target.value)}
                disabled={!dropoffGovernorateId}
              >
                <option value="">Select delegation</option>
                {delegations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameDelegation}
                  </option>
                ))}
              </select>
            </FieldLine>
          )}
          {!localPickupOnly && (
            <FieldLine label="Street / landmark (optional)">
              <input
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark] md:col-span-2"
                value={dropoffStreet}
                onChange={(e) => setDropoffStreet(e.target.value)}
              />
            </FieldLine>
          )}
          <FieldLine label="Weight (kg)">
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
              type="number"
              min="0"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </FieldLine>
          <FieldLine label="Confirmation / auto-cancel window (minutes)">
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
              type="number"
              min="1"
              max="180"
              step="1"
              value={maxConfirmationDelayMinutes}
              onChange={(e) => setMaxConfirmationDelayMinutes(e.target.value)}
            />
          </FieldLine>
          <FieldLine label="Additional driver price (coins)">
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
              type="number"
              min="0"
              step="0.1"
              value={extraAmount}
              onChange={(e) => setExtraAmount(e.target.value)}
            />
          </FieldLine>
        </div>
        <FieldLine label="Description (optional)">
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:[color-scheme:dark]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FieldLine>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={localPickupOnly} onChange={(e) => setLocalPickupOnly(e.target.checked)} />
          Local pickup only
        </label>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
            onClick={runPreview}
          >
            Preview
          </button>
        </div>
        {preview && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Price Preview</h3>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Ready to create</span>
                {Number(preview.effectiveDiscountPercent || 0) !== 0 && (
                  <span className="rounded-full bg-violet-600 px-2 py-1 text-xs font-medium text-white">
                    Discount Applied
                  </span>
                )}
                {Number(preview.nightFee || 0) > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-black">
                    Night Delivery
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div className="rounded-lg border bg-background/70 px-3 py-2">Weight: <b>{Number(preview.weightKg || 0).toFixed(2)} kg</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Distance: <b>{Number(preview.distanceKm || 0).toFixed(2)} km</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Billing distance: <b>{Number(preview.billingDistanceKm || 0).toFixed(2)} km</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Price / km: <b>{money(preview.pricePerKm || 0)}</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Night fee: <b>{money(preview.nightFee || 0)}</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Confirmation delay: <b>{Number(preview.maxConfirmationDelayMinutes || 15)} min</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Additional driver price: <b>{money(preview.customerExtraAmount || 0)}</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Price after discount: <b>{money(preview.discountedPrice || 0)}</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Discount: <b>{Number(preview.effectiveDiscountPercent || 0).toFixed(2)}%</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Reserve: <b>{money(preview.reserveAmount || 0)}</b></div>
              <div className="rounded-lg border bg-background/70 px-3 py-2">Required capacity: <b>{money(preview.requiredCapacity || 0)}</b></div>
              <div className="rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100 md:col-span-2">
                Total to charge: <b>{money(preview.totalPrice || 0)}</b>
              </div>
            </div>
            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground shadow" onClick={createOrder}>
              Create Order
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Preview is mandatory before create. Drivers can identify this as a company order from order source metadata.
        </p>
      </section>

      <section className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Orders</h2>
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground dark:[color-scheme:dark]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
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
              {order.status === "SEARCHING_DRIVER" && (
                <div className="mt-2 rounded-md border p-2">
                  <span className="hidden" aria-hidden>
                    {listTick}
                  </span>
                  <div className="mb-1 text-xs text-muted-foreground">
                    Auto-cancel window: {Number(order.cancelAfterMinutes || 15)} min · Remaining:{" "}
                    <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatSearchingRemain(order)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-28 rounded-md border px-2 py-1 text-xs"
                      type="number"
                      min="1"
                      max="180"
                      step="1"
                      value={addDelayMinutesByOrder[order.id] ?? "15"}
                      onChange={(e) =>
                        setAddDelayMinutesByOrder((prev) => ({ ...prev, [order.id]: e.target.value }))
                      }
                      placeholder="Add minutes"
                    />
                    <button
                      className="rounded-md border px-2 py-1 text-xs"
                      onClick={() => addConfirmationDelay(order.id)}
                    >
                      Add Time
                    </button>
                  </div>
                </div>
              )}
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
