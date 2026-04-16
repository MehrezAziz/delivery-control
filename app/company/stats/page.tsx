"use client";

import { useEffect, useState } from "react";

type Stats = { orders?: number; delivered?: number; returned?: number; cancelled?: number; grossAmount?: string | number };

export default function CompanyStatsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (fromDate) qs.set("from", fromDate);
        if (toDate) qs.set("to", toDate);
        const path = qs.toString() ? `/api/company/stats?${qs.toString()}` : "/api/company/stats";
        const res = await fetch(path);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load stats");
        setStats(data || {});
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [fromDate, toDate]);

  if (loading) return <div>Loading stats...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{error}</div>}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Date Range</h2>
        <div className="flex flex-wrap gap-2">
          <input type="date" className="rounded-md border px-3 py-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="rounded-md border px-3 py-2" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Orders</p>
          <p className="text-lg font-semibold">{stats?.orders || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Delivered</p>
          <p className="text-lg font-semibold">{stats?.delivered || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Returned</p>
          <p className="text-lg font-semibold">{stats?.returned || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Cancelled</p>
          <p className="text-lg font-semibold">{stats?.cancelled || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Gross Amount</p>
          <p className="text-lg font-semibold">{Number(stats?.grossAmount || 0).toFixed(2)}</p>
        </div>
      </section>
    </div>
  );
}
