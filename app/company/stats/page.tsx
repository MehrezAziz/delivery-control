"use client";

import { useEffect, useState } from "react";

type Stats = { orders?: number; delivered?: number; returned?: number; cancelled?: number; grossAmount?: string | number };
type CompanyOrder = { createdAt: string; status: string; price?: number | string; localPickupOnly?: boolean };

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
const startOfWeek = (d: Date) => {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export default function CompanyStatsPage() {
  const now = new Date();
  const [fromDate, setFromDate] = useState(toDateInput(startOfMonth(now)));
  const [toDate, setToDate] = useState(toDateInput(now));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pickupFilter, setPickupFilter] = useState("ALL");
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<CompanyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, ordersRes] = await Promise.all([
          fetch(`/api/company/stats?from=${fromDate}&to=${toDate}`),
          fetch("/api/company/orders"),
        ]);
        const statsData = await statsRes.json();
        const ordersData = await ordersRes.json();
        if (!statsRes.ok) throw new Error(statsData?.error || "Failed to load stats");
        if (!ordersRes.ok) throw new Error(ordersData?.error || "Failed to load orders");
        setStats(statsData || {});
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [fromDate, toDate]);

  if (loading) return <div>Loading stats...</div>;

  const filteredOrders = orders.filter((o) => {
    const created = new Date(o.createdAt);
    const fromOk = fromDate ? created >= new Date(`${fromDate}T00:00:00`) : true;
    const toOk = toDate ? created <= new Date(`${toDate}T23:59:59`) : true;
    const statusOk = statusFilter === "ALL" ? true : o.status === statusFilter;
    const pickupOk =
      pickupFilter === "ALL"
        ? true
        : pickupFilter === "LOCAL_ONLY"
          ? !!o.localPickupOnly
          : !o.localPickupOnly;
    return fromOk && toOk && statusOk && pickupOk;
  });

  const filtered = {
    orders: filteredOrders.length,
    delivered: filteredOrders.filter((o) => o.status === "DELIVERED").length,
    returned: filteredOrders.filter((o) => o.status === "RETURNED" || o.status === "RETURN_DEPOSIT").length,
    cancelled: filteredOrders.filter((o) => o.status === "CANCELLED").length,
    grossAmount: filteredOrders.reduce((sum, o) => sum + Number(o.price || 0), 0),
  };

  const applyPreset = (preset: "today" | "week" | "month" | "year") => {
    const ref = new Date();
    const to = toDateInput(ref);
    let from = to;
    if (preset === "week") from = toDateInput(startOfWeek(ref));
    if (preset === "month") from = toDateInput(startOfMonth(ref));
    if (preset === "year") from = toDateInput(startOfYear(ref));
    setFromDate(from);
    setToDate(to);
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{error}</div>}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Date Range</h2>
        <div className="mb-2 flex flex-wrap gap-2">
          <button className="rounded-md border px-2 py-1 text-sm" onClick={() => applyPreset("today")}>Today</button>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={() => applyPreset("week")}>This week</button>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={() => applyPreset("month")}>This month</button>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={() => applyPreset("year")}>This year</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" className="rounded-md border px-3 py-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="rounded-md border px-3 py-2" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <select className="rounded-md border px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="RETURNED">Returned</option>
            <option value="RETURN_DEPOSIT">Return deposit</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select className="rounded-md border px-3 py-2" value={pickupFilter} onChange={(e) => setPickupFilter(e.target.value)}>
            <option value="ALL">All pickup types</option>
            <option value="LOCAL_ONLY">Local pickup only</option>
            <option value="WITH_DROPOFF">With dropoff</option>
          </select>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Orders</p>
          <p className="text-lg font-semibold">{filtered.orders || stats?.orders || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Delivered</p>
          <p className="text-lg font-semibold">{filtered.delivered || stats?.delivered || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Returned</p>
          <p className="text-lg font-semibold">{filtered.returned || stats?.returned || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Cancelled</p>
          <p className="text-lg font-semibold">{filtered.cancelled || stats?.cancelled || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Gross Amount</p>
          <p className="text-lg font-semibold">{Number(filtered.grossAmount || stats?.grossAmount || 0).toFixed(2)}</p>
        </div>
      </section>
    </div>
  );
}
