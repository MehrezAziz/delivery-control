"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  MapPin,
  MapPinOff,
  RefreshCw,
  Search,
  ShieldAlert,
  Truck,
  User,
  XCircle,
} from "lucide-react";

type Row = {
  id: string;
  status: string;
  customerReason: string;
  driverFeedback: string | null;
  resolutionNote: string | null;
  createdAt: string;
  order: {
    id: string;
    status: string;
    pickupAddress: {
      delegation: { nameDelegation: string; governorate: { nameGovernorate: string } };
    } | null;
  };
  customer: { user: { firstName: string | null; secondName: string | null; phone: string } | null };
  driver: { user: { firstName: string | null; secondName: string | null; phone: string } | null };
};

type StatusFilter =
  | "all"
  | "PENDING"
  | "RESOLVED_FORGIVE"
  | "RESOLVED_SUSPEND_CUSTOMER"
  | "RESOLVED_SUSPEND_DRIVER";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED_FORGIVE", label: "Forgiven" },
  { value: "RESOLVED_SUSPEND_CUSTOMER", label: "Customer suspended" },
  { value: "RESOLVED_SUSPEND_DRIVER", label: "Driver suspended" },
];

function statusClass(status: string) {
  if (status === "PENDING") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (status === "RESOLVED_FORGIVE") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "RESOLVED_SUSPEND_CUSTOMER" || status === "RESOLVED_SUSPEND_DRIVER") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }
  return "bg-muted text-muted-foreground";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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

function personName(user?: { firstName: string | null; secondName: string | null } | null) {
  if (!user) return "—";
  return `${user.firstName ?? ""} ${user.secondName ?? ""}`.trim() || "—";
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function OrderArrivalConflictsView(props: {
  listUrl: string;
  resolveUrlPrefix: string;
  orderDetailPrefix: string;
}) {
  const { listUrl, resolveUrlPrefix, orderDetailPrefix } = props;
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [reasonTargetId, setReasonTargetId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<"FORGIVE" | "SUSPEND_CUSTOMER" | "SUSPEND_DRIVER" | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await fetch(listUrl, { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAllRows(data.conflicts || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }, [listUrl]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const stats = useMemo(() => {
    const pending = allRows.filter((r) => r.status === "PENDING").length;
    const forgiven = allRows.filter((r) => r.status === "RESOLVED_FORGIVE").length;
    const suspended =
      allRows.filter((r) => r.status === "RESOLVED_SUSPEND_CUSTOMER" || r.status === "RESOLVED_SUSPEND_DRIVER").length;
    return { total: allRows.length, pending, forgiven, suspended };
  }, [allRows]);

  const filtered = useMemo(() => {
    let result = allRows;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const cust = personName(r.customer?.user).toLowerCase();
        const drv = personName(r.driver?.user).toLowerCase();
        const area = r.order.pickupAddress
          ? `${r.order.pickupAddress.delegation.nameDelegation} ${r.order.pickupAddress.delegation.governorate.nameGovernorate}`.toLowerCase()
          : "";
        return (
          r.order.id.toLowerCase().includes(q) ||
          cust.includes(q) ||
          drv.includes(q) ||
          area.includes(q) ||
          r.customerReason.toLowerCase().includes(q) ||
          (r.driverFeedback || "").toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [allRows, statusFilter, search]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openReasonDialog(
    id: string,
    action: "FORGIVE" | "SUSPEND_CUSTOMER" | "SUSPEND_DRIVER" | null,
    currentNote?: string | null,
  ) {
    setReasonTargetId(id);
    setReasonAction(action);
    setReasonText(currentNote || "");
    setReasonOpen(true);
  }

  async function submitReason() {
    if (!reasonTargetId) return;
    const currentAction = reasonAction;
    const id = reasonTargetId;
    if (currentAction && currentAction !== "FORGIVE" && !window.confirm(`Confirm ${currentAction.replace(/_/g, " ")}?`)) return;
    setActing(id + (currentAction || "NOTE"));
    try {
      const res = await fetch(`${resolveUrlPrefix}/${reasonTargetId}/resolve`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(currentAction ? { action: currentAction } : {}),
          note: reasonText.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setReasonOpen(false);
      setReasonTargetId(null);
      setReasonAction(null);
      setReasonText("");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-amber-50/50 via-background to-background dark:from-amber-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-amber-50/50 via-background to-background dark:from-amber-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500 via-orange-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <MapPinOff className="h-3.5 w-3.5" />
                  Arrival incident desk
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Arrival incidents</h1>
                <p className="max-w-xl text-sm text-white/80">
                  When a customer rejects a driver after arrival, review both statements and record a decision.
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
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total incidents", value: stats.total, icon: ShieldAlert },
                { label: "Pending", value: stats.pending, icon: Clock },
                { label: "Forgiven", value: stats.forgiven, icon: CheckCircle2 },
                { label: "Suspended", value: stats.suspended, icon: XCircle },
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

        {err && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {err}
          </div>
        )}

        {/* Filters */}
        <Card className="border-amber-100/60 dark:border-amber-900/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search order, customer, driver, area…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} of {allRows.length} incidents
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
                      ? "bg-amber-600 text-white"
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
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-amber-600" />
              Incident records
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <MapPinOff className="h-10 w-10 opacity-40" />
                <p>No arrival incidents match your filters.</p>
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
                      <TableHead>Order</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Parties</TableHead>
                      <TableHead>Statements</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const custName = personName(r.customer?.user);
                      const drvName = personName(r.driver?.user);
                      const area = r.order.pickupAddress
                        ? `${r.order.pickupAddress.delegation.nameDelegation}, ${r.order.pickupAddress.delegation.governorate.nameGovernorate}`
                        : "—";
                      const busy = acting?.startsWith(r.id);

                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30 align-top">
                          <TableCell>
                            <Link
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                              href={`${orderDetailPrefix}/${r.order.id}`}
                            >
                              {r.order.id.slice(0, 8)}…
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {r.order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            <span className="inline-flex items-start gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              {area}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusClass(r.status)}>
                              {formatStatus(r.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold dark:bg-amber-900/40 dark:text-amber-300">
                                  {initials(custName)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium flex items-center gap-1">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    {custName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{r.customer?.user?.phone}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold dark:bg-orange-900/40 dark:text-orange-300">
                                  {initials(drvName)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium flex items-center gap-1">
                                    <Truck className="h-3 w-3 text-muted-foreground" />
                                    {drvName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{r.driver?.user?.phone}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <div className="space-y-2 text-xs">
                              <div className="rounded-md bg-muted/40 p-2">
                                <span className="font-semibold text-foreground">Customer: </span>
                                <span className="text-muted-foreground">{r.customerReason}</span>
                              </div>
                              {r.driverFeedback ? (
                                <div className="rounded-md bg-muted/40 p-2">
                                  <span className="font-semibold text-foreground">Driver: </span>
                                  <span className="text-muted-foreground">{r.driverFeedback}</span>
                                </div>
                              ) : null}
                              {r.resolutionNote ? (
                                <p className="text-muted-foreground italic">Note: {r.resolutionNote}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(r.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === "PENDING" ? (
                              <div className="flex flex-col gap-1.5 items-end">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={!!acting}
                                  onClick={() => openReasonDialog(r.id, "FORGIVE", r.resolutionNote)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  {busy && acting?.endsWith("FORGIVE") ? "…" : "Forgive"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={!!acting}
                                  onClick={() => openReasonDialog(r.id, "SUSPEND_CUSTOMER", r.resolutionNote)}
                                >
                                  {busy && acting?.endsWith("SUSPEND_CUSTOMER") ? "…" : "Suspend customer"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={!!acting}
                                  onClick={() => openReasonDialog(r.id, "SUSPEND_DRIVER", r.resolutionNote)}
                                >
                                  {busy && acting?.endsWith("SUSPEND_DRIVER") ? "…" : "Suspend driver"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!!acting}
                                  onClick={() => openReasonDialog(r.id, null, r.resolutionNote)}
                                >
                                  {acting === r.id + "NOTE" ? "…" : "Edit note"}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5 items-end">
                                <span className="text-xs text-muted-foreground">Closed</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!acting}
                                  onClick={() => openReasonDialog(r.id, null, r.resolutionNote)}
                                >
                                  {acting === r.id + "NOTE" ? "…" : "Edit note"}
                                </Button>
                              </div>
                            )}
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

        <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {reasonAction ? `Decision: ${reasonAction.replace(/_/g, " ").toLowerCase()}` : "Update resolution note"}
              </DialogTitle>
            </DialogHeader>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Write a reason or internal note…"
              rows={5}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReasonOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submitReason()} disabled={!reasonTargetId || !!acting}>
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
