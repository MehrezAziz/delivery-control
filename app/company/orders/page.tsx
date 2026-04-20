"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageSquare, Pencil } from "lucide-react";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { formatCoinsCeil3 } from "@/lib/format-coins";
import { connectSocket, getSocket } from "@/lib/socket";
import { isViewerOnCompanyOrdersChrome } from "@/lib/company-orders-inbox";

type CompanyOrder = {
  id: string;
  status: string;
  deliveryCompany?: { id: string; name: string; legalName?: string | null } | null;
  customer?: {
    id: string;
    deliveryCompanyProxyFor?: { id: string; name: string; legalName?: string | null } | null;
  } | null;
  deliveryCompanyDepartment?: { id: string; label: string } | null;
  createdByDepartmentAccount?: {
    id: string;
    email: string;
    role: string;
    department?: { id: string; label: string } | null;
  } | null;
  price?: string | number | null;
  cancelAfterMinutes?: number | null;
  cancelRemainingSeconds?: number | null;
  cancelTimerLastResumedAt?: string | null;
  createdAt: string;
  sourceType?: string;
  description?: string | null;
  weight?: number;
  localPickupOnly?: boolean;
  customerExtraAmount?: number | null;
  deliveryCompanyDepartmentId?: string | null;
  pickupAddress?: {
    id: string;
    delegation?: { governorate?: { id: string }; governorateId?: string };
  } | null;
  dropoffAddress?: {
    delegationId?: string;
    delegation?: { governorate?: { id: string }; governorateId?: string };
  } | null;
  returnDepositFeedback?: { id: string; feedback: string; conditionIssue: boolean } | null;
  returnDepositFeedbacks?: Array<{ driverId: string; feedback: string; conditionIssue: boolean }>;
  driverAssignment?: { driverId?: string } | null;
  trackingToken?: string | null;
};

const TRACKING_LIVE_STATUSES = new Set(["DRIVER_ARRIVED", "PICKED_UP", "DELIVERING"]);

/** Prefer FK on order; fallback: customer is the company proxy customer → delivery company name. */
function deliveryCompanyDisplayName(order: CompanyOrder): string {
  const dc = order.deliveryCompany;
  if (dc) {
    const n = (dc.legalName?.trim() || dc.name?.trim()) ?? "";
    if (n) return n;
  }
  const viaProxy = order.customer?.deliveryCompanyProxyFor;
  if (viaProxy) {
    return (viaProxy.legalName?.trim() || viaProxy.name?.trim()) || "—";
  }
  return "—";
}

/** MAIN_ADMIN list only; omits generic fallbacks (no “main company / API” line). */
function formatOrderPlacedBy(order: CompanyOrder): string | null {
  const acc = order.createdByDepartmentAccount;
  if (acc) {
    const deptName =
      acc.department?.label?.trim() || order.deliveryCompanyDepartment?.label?.trim();
    return deptName
      ? `${deptName} — ${acc.email} (${acc.role})`
      : `${acc.email} (${acc.role})`;
  }
  if (order.deliveryCompanyDepartment?.label) {
    return `Department “${order.deliveryCompanyDepartment.label}”`;
  }
  return null;
}

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

function orderStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    SEARCHING_DRIVER: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    PENDING_CUSTOMER_APPROVAL: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
    DRIVER_ASSIGNED: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    DRIVER_ARRIVED: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
    PICKED_UP: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
    DELIVERING: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
    DELIVERED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    RETURNED: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
    RETURN_DEPOSIT: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
    CANCELLED: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    DISPUTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    REFUNDED: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  };
  return map[status] || "bg-muted text-foreground";
}

function effectiveReturnDepositFeedbackRow(order: CompanyOrder) {
  const drvId = order.driverAssignment?.driverId;
  const list = order.returnDepositFeedbacks;
  if (drvId && list?.length) {
    const m = list.find((f) => f.driverId === drvId);
    if (m) return m;
  }
  return order.returnDepositFeedback ?? null;
}

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

function CompanyOrdersPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    baseFee?: number;
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
    extraWeightFee?: number;
    distanceFee?: number;
    maxConfirmationDelayMinutes: number;
  } | null>(null);
  const [showRequiredCoinsInfo, setShowRequiredCoinsInfo] = useState(false);
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [feedbackConditionIssue, setFeedbackConditionIssue] = useState<Record<string, boolean>>({});
  const [addDelayMinutesByOrder, setAddDelayMinutesByOrder] = useState<Record<string, string>>({});
  /** Return-flow feedback: panel open per order, edit mode when updating saved feedback */
  const [returnFeedbackOpen, setReturnFeedbackOpen] = useState<Record<string, boolean>>({});
  const [returnFeedbackEditing, setReturnFeedbackEditing] = useState<Record<string, boolean>>({});
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  /** From GET /api/company/wallet — department scoped for department accounts, company for MAIN_ADMIN. */
  const [walletAvailableCapacity, setWalletAvailableCapacity] = useState<number | null>(null);
  const editFromUrlApplied = useRef<string | null>(null);
  const isChildDepartment = !!profile?.actorRole && profile.actorRole !== "MAIN_ADMIN";
  const canEditOrders =
    !!profile?.actorRole && ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"].includes(profile.actorRole);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const selectedPickupAddress = (profile?.addresses || []).find((a) => a.id === pickupAddressId) || null;
  const pickupCountry = geo.countries.find(
    (c) =>
      c.name.toLowerCase() === String(selectedPickupAddress?.country || "").toLowerCase() ||
      c.name.toLowerCase() === String(selectedPickupAddress?.country || "").trim().toLowerCase(),
  ) || null;
  const governorates = pickupCountry?.governorates || [];
  const selectedGovernorate = governorates.find((g) => g.id === dropoffGovernorateId) || null;
  const delegations = selectedGovernorate?.delegations || [];
  const money = (value: number) => `${formatCoinsCeil3(value)} coins`;

  const loadRef = useRef<((keepLoading?: boolean) => Promise<void>) | null>(null);
  const load = async (keepLoading = false) => {
    if (!keepLoading) setLoading(true);
    try {
      const [profileRes, ordersRes, walletRes] = await Promise.all([
        fetch("/api/company/profile").then((x) => x.json()),
        fetch("/api/company/orders").then((x) => x.json()),
        fetch("/api/company/wallet"),
      ]);
      let capacity: number | null = null;
      try {
        if (walletRes.ok) {
          const wd = await walletRes.json();
          if (typeof wd.availableCapacity === "number") {
            capacity = Number(wd.availableCapacity);
          }
        }
      } catch {
        capacity = null;
      }
      setWalletAvailableCapacity(capacity);
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
        const mainAddress = profileRes.addresses.find(
          (a: { id: string; isMainDepartment?: boolean }) => a.isMainDepartment,
        );
        const defaultDept =
          childAddress ||
          (!isChild ? mainAddress : null) ||
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

  const approveDriverQuick = async (orderId: string) => {
    setMessage(null);
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/company/orders/${orderId}/approve-driver`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Failed to approve driver");
      await loadRef.current?.(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to approve driver");
    } finally {
      setApprovingId(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => void loadRef.current?.(true);
    const refreshOrder = (payload: { orderId?: string }) => {
      if (payload?.orderId) void loadRef.current?.(true);
    };
    async function initSocket() {
      try {
        const meRes = await fetch("/api/company-auth/me", { cache: "no-store" });
        if (!meRes.ok || cancelled) return;
        const me = await meRes.json();
        if (!me?.token || cancelled) return;
        const socket = connectSocket(String(me.token));
        socket.on("notification", refresh);
        socket.on("order_chat_refresh", refresh);
        socket.on("order_updated", refreshOrder);
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
      s?.off("order_updated", refreshOrder);
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

  const exitEditMode = useCallback(() => {
    setEditingOrderId(null);
    setPreview(null);
    setPreviewSignature(null);
    editFromUrlApplied.current = null;
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has("edit")) {
        u.searchParams.delete("edit");
        window.history.replaceState({}, "", u.pathname + (u.search ? u.search : ""));
      }
    }
  }, []);

  const applyOrderToForm = useCallback((order: CompanyOrder) => {
    setEditingOrderId(order.id);
    setMessage(null);
    setWeight(String(order.weight ?? 1));
    setMaxConfirmationDelayMinutes(String(order.cancelAfterMinutes ?? 15));
    setExtraAmount(String(order.customerExtraAmount ?? 0));
    setLocalPickupOnly(!!order.localPickupOnly);
    const desc = String(order.description || "");
    const cm = desc.match(/Customer:\s*([^\n]+)/);
    const pm = desc.match(/Phone:\s*([^\n]+)/);
    const dst = desc.match(/Destination street:\s*([^\n]+)/);
    if (cm) setCustomerName(cm[1].trim());
    if (pm) setCustomerPhone(pm[1].trim());
    else setCustomerPhone("");
    if (dst) setDropoffStreet(dst[1].trim());
    else setDropoffStreet("");
    const userDesc = desc
      .split("\n")
      .filter(
        (l) =>
          !/^Customer:/.test(l) &&
          !/^Phone:/.test(l) &&
          !/^Destination street:/.test(l) &&
          !/^Source:/.test(l),
      )
      .join("\n")
      .trim();
    setDescription(userDesc);
    const pickId = order.pickupAddress?.id;
    const deptId = order.deliveryCompanyDepartmentId;
    if (pickId) setPickupAddressId(pickId);
    else if (deptId) setPickupAddressId(deptId);
    const drop = order.dropoffAddress;
    const govId = drop?.delegation?.governorate?.id || drop?.delegation?.governorateId;
    if (govId) setDropoffGovernorateId(govId);
    if (drop?.delegationId) setDropoffDelegationId(drop.delegationId);
    setPreview(null);
    setPreviewSignature(null);
  }, []);

  useEffect(() => {
    const id = searchParams.get("edit");
    if (!id || !canEditOrders || !orders.length) return;
    if (editFromUrlApplied.current === id) return;
    const found = orders.find((o) => o.id === id);
    if (found?.status === "SEARCHING_DRIVER") {
      applyOrderToForm(found);
      editFromUrlApplied.current = id;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [searchParams, orders, canEditOrders, applyOrderToForm]);

  const submitOrder = async () => {
    setMessage(null);
    try {
      const currentPayload = payload();
      if (!preview || previewSignature !== JSON.stringify(currentPayload)) {
        throw new Error("Preview is required before create. Please run preview after your latest changes.");
      }
      if (editingOrderId) {
        const res = await fetch(`/api/company/orders/${editingOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || data?.message || "Order update failed");
        setMessage("Order updated successfully.");
        exitEditMode();
        await load(true);
        return;
      }
      const idemKey = buildIdempotencyKey("company-orders-create", currentPayload);
      const suppressInbox = isViewerOnCompanyOrdersChrome(pathname);
      const res = await fetch("/api/company/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey,
          ...(suppressInbox ? { "X-Suppress-Company-Order-Inbox": "1" } : {}),
        },
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
      setMessage(e instanceof Error ? e.message : "Order failed");
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
      /** Default UI shows 15 but state may be unset until the user edits the input — treat default as 15. */
      const raw = addDelayMinutesByOrder[orderId];
      const minutesToAdd = Number((raw !== undefined && raw !== "" ? raw : "15").trim());
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
      "id,status,deliveryCompanyName,price,placedByDeptLabel,placedByEmail,placedByRole,sourceType,description,createdAt",
      ...filteredOrders.map((o) =>
        [
          o.id,
          o.status,
          deliveryCompanyDisplayName(o),
          formatCoinsCeil3(o.price || 0),
          o.createdByDepartmentAccount?.department?.label ||
            o.deliveryCompanyDepartment?.label ||
            "",
          o.createdByDepartmentAccount?.email || "",
          o.createdByDepartmentAccount?.role || "",
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {editingOrderId ? `Edit order (${editingOrderId.slice(0, 8)}…)` : "Create Delivery Order"}
          </h2>
          {editingOrderId && (
            <button
              type="button"
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              onClick={exitEditMode}
            >
              Cancel edit
            </button>
          )}
        </div>
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
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
            <h3 className="mb-3 text-sm font-semibold">Order Review</h3>
            <div className="space-y-2 text-sm">
              <div className="space-y-2 rounded-lg border bg-background/70 p-2">
                <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                  <span>Base fee</span>
                  <span><b>{money(preview.baseFee || 0)}</b></span>
                </div>
                <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                  <span>Weight: <b>{Number(preview.weightKg || 0).toFixed(2)} kg</b></span>
                  <span><b>{money(preview.extraWeightFee || 0)}</b></span>
                </div>
                <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                  <span>Distance: <b>~{Number(preview.distanceKm || 0).toFixed(2)} km</b></span>
                  <span>
                    <b>
                      {money(
                        typeof preview.distanceFee === "number"
                          ? preview.distanceFee
                          : Number(preview.pricePerKm || 0) * Number(preview.billingDistanceKm || 0),
                      )}
                    </b>
                  </span>
                </div>
                {Number(preview.nightFee || 0) !== 0 && (
                  <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                    <span>Night fee</span>
                    <span><b>{money(preview.nightFee || 0)}</b></span>
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2 dark:border-violet-900 dark:bg-violet-950/20">
                <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-violet-900 dark:text-violet-200">
                  <span><b>Total</b></span>
                  <span>
                    <b>
                      {money(
                        Number(preview.baseFee || 0) +
                          Number(preview.extraWeightFee || 0) +
                          Number(
                            typeof preview.distanceFee === "number"
                              ? preview.distanceFee
                              : Number(preview.pricePerKm || 0) * Number(preview.billingDistanceKm || 0),
                          ) +
                          Number(preview.nightFee || 0),
                      )}
                    </b>
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                  <span>
                    Discount: <b>{Number(preview.effectiveDiscountPercent || 0).toFixed(2)}%</b>
                  </span>
                  <span>
                    <b>{money(preview.discountedPrice || 0)}</b>
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 dark:border-emerald-900 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                  <span>Additional driver price</span>
                  <span><b>{money(preview.customerExtraAmount || 0)}</b></span>
                </div>
                <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-emerald-900 dark:text-emerald-200">
                  <span><b>Total to pay</b></span>
                  <span><b>{money(preview.totalPrice || 0)}</b></span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground shadow"
                onClick={submitOrder}
              >
                {editingOrderId ? "Save changes" : "Create Order"}
              </button>
              {walletAvailableCapacity !== null && (
                <span className="text-sm text-muted-foreground">
                  Available balance:{" "}
                  <span className="font-semibold text-foreground">{money(walletAvailableCapacity)}</span>
                  {isChildDepartment && (
                    <span className="ml-1 text-xs">(this department account)</span>
                  )}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              coins required to place this order: Total + 50% = {money(preview.requiredCapacity || 0)}{" "}
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold"
                aria-label="Explain required coins"
                onClick={() => setShowRequiredCoinsInfo((v) => !v)}
              >
                i
              </button>
            </p>
            {showRequiredCoinsInfo && (
              <p className="mt-1 text-xs text-muted-foreground">
                In case of order returned, the driver also gets 50% because he turns back the order to you.
                If the order is delivered or cancelled, these coins return back to you.
              </p>
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Preview is mandatory before {editingOrderId ? "saving" : "create"}. Drivers can identify this as a company
          order from order source metadata.
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
          {pagedOrders.map((order) => {
            const placedByLine =
              profile?.actorRole === "MAIN_ADMIN" ? formatOrderPlacedBy(order) : null;
            return (
            <div
              key={order.id}
              className={`rounded-md border p-3 text-sm ${
                order.status === "PENDING_CUSTOMER_APPROVAL"
                  ? "border-violet-300/80 bg-gradient-to-br from-violet-100/90 via-fuchsia-50/80 to-amber-50/70 dark:border-violet-700/60 dark:from-violet-950/45 dark:via-fuchsia-950/35 dark:to-amber-950/25"
                  : ""
              }`}
            >
              <div className="flex justify-between gap-2">
                <Link
                  href={`/company/orders/${order.id}`}
                  className="break-all font-medium text-primary underline-offset-2 hover:underline"
                  title="View order details"
                >
                  {order.id}
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${orderStatusBadgeClass(order.status)}`}
                >
                  {order.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {order.status === "SEARCHING_DRIVER" && canEditOrders && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    title="Edit order (still searching for a driver)"
                    onClick={() => {
                      applyOrderToForm(order);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                )}
                {order.status === "PENDING_CUSTOMER_APPROVAL" && canEditOrders && (
                  <button
                    type="button"
                    className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-60"
                    disabled={approvingId === order.id}
                    onClick={() => void approveDriverQuick(order.id)}
                  >
                    {approvingId === order.id ? "Approving…" : "Accept driver"}
                  </button>
                )}
              </div>
              <p className="text-muted-foreground">
                Price: {formatCoinsCeil3(order.price || 0)}
              </p>
              {profile?.actorRole &&
                profile.actorRole !== "MAIN_ADMIN" &&
                order.trackingToken &&
                (TRACKING_LIVE_STATUSES.has(order.status) ? (
                  <p className="mt-1">
                    <Link
                      href={`/company/orders/${order.id}/track`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Open live tracking (new tab) · {order.trackingToken}
                    </Link>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tracking code: <span className="font-mono text-foreground">{order.trackingToken}</span> — live map opens in a new tab when status is arrived, picked up, or delivering.
                  </p>
                ))}
              {placedByLine && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Placed by:{" "}
                  <span className="font-medium text-foreground">{placedByLine}</span>
                </p>
              )}
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
              {(order.status === "RETURNED" || order.status === "RETURN_DEPOSIT") && canEditOrders && (
                <div className="mt-2 rounded-md border border-dashed border-primary/30 bg-muted/30 p-2">
                  {(() => {
                    const rowFb = effectiveReturnDepositFeedbackRow(order);
                    return (
                      <>
                  {!returnFeedbackOpen[order.id] && !rowFb && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted"
                      onClick={() => setReturnFeedbackOpen((p) => ({ ...p, [order.id]: true }))}
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                      Add feedback
                    </button>
                  )}
                  {(returnFeedbackOpen[order.id] || rowFb) && (
                    <div className="space-y-2">
                      {rowFb && !returnFeedbackEditing[order.id] ? (
                        <div className="space-y-1">
                          <p className="whitespace-pre-wrap text-sm">{rowFb.feedback}</p>
                          <p className="text-xs text-muted-foreground">
                            Condition issue: {rowFb.conditionIssue ? "Yes" : "No"}
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"
                            onClick={() => {
                              setReturnFeedbackEditing((p) => ({ ...p, [order.id]: true }));
                              setFeedbackText((prev) => ({
                                ...prev,
                                [order.id]: rowFb.feedback ?? "",
                              }));
                              setFeedbackConditionIssue((prev) => ({
                                ...prev,
                                [order.id]: !!rowFb.conditionIssue,
                              }));
                              setReturnFeedbackOpen((p) => ({ ...p, [order.id]: true }));
                            }}
                          >
                            <Pencil className="h-3 w-3" aria-hidden />
                            Edit feedback
                          </button>
                        </div>
                      ) : (
                        <>
                          <textarea
                            className="min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            value={
                              feedbackText[order.id] ?? rowFb?.feedback ?? ""
                            }
                            onChange={(e) =>
                              setFeedbackText((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            placeholder="Describe package condition…"
                          />
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={
                                feedbackConditionIssue[order.id] ??
                                !!rowFb?.conditionIssue
                              }
                              onChange={(e) =>
                                setFeedbackConditionIssue((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.checked,
                                }))
                              }
                            />
                            Package condition issue
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                              onClick={async () => {
                                await submitReturnFeedback(order.id);
                                setReturnFeedbackEditing((p) => ({ ...p, [order.id]: false }));
                              }}
                            >
                              Save feedback
                            </button>
                            {!rowFb && (
                              <button
                                type="button"
                                className="rounded-md border px-2 py-1 text-xs"
                                onClick={() => setReturnFeedbackOpen((p) => ({ ...p, [order.id]: false }))}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            );
          })}
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

export default function CompanyOrdersPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading orders…</div>}>
      <CompanyOrdersPageContent />
    </Suspense>
  );
}
