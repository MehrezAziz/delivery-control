"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Filter,
  RefreshCw,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";

type Refund = {
  id: string;
  amountCoins: string | number;
  status: string;
  reason?: string | null;
  createdAt: string;
  processedAt?: string | null;
  deliveryCompany?: { name: string } | null;
};

type StatusFilter = "all" | "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "FAILED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
];

function statusClass(status: string) {
  if (status === "PENDING") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (status === "APPROVED") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (status === "PAID") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "REJECTED" || status === "FAILED") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function DeliveryCompanyRefundsAdminPage() {
  const [rows, setRows] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/delivery-companies/refund-requests");
    const data = await res.json();
    if (!res.ok) {
      setMessageType("error");
      setMessage(data?.error || "Failed to load refund requests");
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "PENDING").length;
    const approved = rows.filter((r) => r.status === "APPROVED").length;
    const paid = rows.filter((r) => r.status === "PAID").length;
    const rejected = rows.filter((r) => r.status === "REJECTED" || r.status === "FAILED").length;
    const pendingAmount = rows
      .filter((r) => r.status === "PENDING")
      .reduce((s, r) => s + Number(r.amountCoins || 0), 0);
    return { pending, approved, paid, rejected, pendingAmount };
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.deliveryCompany?.name || "").toLowerCase().includes(q) ||
          (r.reason || "").toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    return result;
  }, [rows, search, statusFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function update(id: string, status: string) {
    setUpdatingId(id);
    setMessage(null);
    const idemKey = buildIdempotencyKey("admin-deliverycompany-refund-decision", { id, status });
    try {
      const res = await fetch(`/api/delivery-companies/refund-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data?.error || "Failed to update");
        return;
      }
      setMessageType("success");
      setMessage(`Refund marked as ${formatStatus(status)}.`);
      await load();
    } catch {
      setMessageType("error");
      setMessage("Network error while updating refund");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-teal-50/50 via-background to-background dark:from-teal-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-teal-50/50 via-background to-background dark:from-teal-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-teal-600 via-emerald-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Link
                  href="/dashboard/delivery-companies"
                  className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Delivery companies
                </Link>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Wallet className="h-3.5 w-3.5" />
                  Refund workflow
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Delivery company refunds</h1>
                <p className="max-w-xl text-sm text-white/80">
                  Review partner refund requests, approve or reject them, then mark payouts as paid once processed.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 bg-white/15 text-white hover:bg-white/25 border-0"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Total requests", value: rows.length, icon: Building2 },
                { label: "Pending", value: stats.pending, icon: Clock },
                { label: "Approved", value: stats.approved, icon: CheckCircle2 },
                { label: "Paid", value: stats.paid, icon: Coins },
                { label: "Pending coins", value: stats.pendingAmount.toFixed(2), icon: Wallet },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
          >
            {messageType === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {message}
          </div>
        )}

        {/* Filters */}
        <Card className="border-teal-100/60 dark:border-teal-900/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search company, reason, or ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} of {rows.length} requests
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-teal-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Refund requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Wallet className="h-10 w-10 opacity-40" />
                <p>No refund requests match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Company</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const companyName = r.deliveryCompany?.name || "—";
                      const busy = updatingId === r.id;
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30 align-top">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-semibold dark:bg-teal-900/40 dark:text-teal-300">
                                {initials(companyName)}
                              </div>
                              <div>
                                <p className="font-medium">{companyName}</p>
                                <p className="text-xs text-muted-foreground font-mono">{r.id.slice(0, 8)}…</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-lg font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                              {Number(r.amountCoins || 0).toFixed(2)}
                            </span>
                            <span className="block text-xs text-muted-foreground">coins</span>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="text-sm text-muted-foreground line-clamp-2">{r.reason || "—"}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusClass(r.status)}>
                              {formatStatus(r.status)}
                            </Badge>
                            {r.processedAt ? (
                              <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.processedAt)}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(r.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap gap-2 justify-end">
                              {r.status === "PENDING" && (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void update(r.id, "APPROVED")}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700"
                                    disabled={busy}
                                    onClick={() => void update(r.id, "REJECTED")}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              {r.status === "APPROVED" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => void update(r.id, "PAID")}
                                >
                                  <Coins className="h-3.5 w-3.5 mr-1" />
                                  Mark paid
                                </Button>
                              )}
                              {r.status !== "PENDING" && r.status !== "APPROVED" && (
                                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                  <ChevronRight className="h-3.5 w-3.5" />
                                  No actions
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
