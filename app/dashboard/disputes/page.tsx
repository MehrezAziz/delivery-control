"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Search,
  RefreshCw,
  Scale,
  User,
  Truck,
  Clock,
  CheckCircle2,
  MapPinOff,
  ChevronRight,
  FileText,
} from "lucide-react";

type DisputeRow = {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  createdAt: string;
  order?: {
    customer?: { user?: { firstName?: string; secondName?: string } };
    driverAssignment?: { driver?: { user?: { firstName?: string; secondName?: string } } };
  };
  customerService?: { superUser?: { pseudo?: string } };
};

type ArrivalConflictRow = {
  id: string;
  orderId: string;
  customerReason: string;
  status: string;
  createdAt: string;
  customer?: { user?: { firstName?: string; secondName?: string } };
  driver?: { user?: { firstName?: string; secondName?: string } };
};

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "INVESTIGATING", label: "Investigating" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
] as const;

function disputeStatusClass(status: string) {
  if (status === "OPEN") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (status === "INVESTIGATING") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (status === "RESOLVED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
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

function personName(user?: { firstName?: string; secondName?: string }) {
  if (!user) return "—";
  return `${user.firstName ?? ""} ${user.secondName ?? ""}`.trim() || "—";
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [arrivalConflicts, setArrivalConflicts] = useState<ArrivalConflictRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState("");
  const [resolveDisputeId, setResolveDisputeId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const url = statusFilter === "ALL" ? "/api/disputes" : `/api/disputes?status=${statusFilter}`;
    Promise.all([
      fetch(url).then((r) => r.json()),
      fetch("/api/admin/order-arrival-conflicts").then((r) => r.json()),
    ])
      .then(([disputesData, conflictsData]) => {
        setDisputes(disputesData || []);
        setArrivalConflicts(conflictsData?.conflicts || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const stats = useMemo(() => {
    const open = disputes.filter((d) => d.status === "OPEN").length;
    const investigating = disputes.filter((d) => d.status === "INVESTIGATING").length;
    const resolved = disputes.filter((d) => d.status === "RESOLVED").length;
    const pendingArrivals = arrivalConflicts.filter((c) => c.status === "PENDING").length;
    return { open, investigating, resolved, pendingArrivals, total: disputes.length };
  }, [disputes, arrivalConflicts]);

  const filteredDisputes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return disputes;
    return disputes.filter((d) => {
      const hay = [
        d.orderId,
        d.reason,
        d.status,
        personName(d.order?.customer?.user),
        personName(d.order?.driverAssignment?.driver?.user),
        d.customerService?.superUser?.pseudo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [disputes, search]);

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    try {
      await fetch(`/api/disputes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      toast.success("Dispute updated");
      setResolveDisputeId(null);
      setResolution("");
      load();
    } catch {
      toast.error("Failed to update dispute");
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-rose-50/50 via-background to-background dark:from-rose-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-rose-600 via-red-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Scale className="h-3.5 w-3.5" />
                  Order disputes &amp; incidents
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 opacity-90" />
                  Disputes
                </h1>
                <p className="text-rose-100 text-sm max-w-2xl">
                  Review customer disputes, assign investigations, resolve cases, and monitor arrival
                  incidents when drivers are rejected on site.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-white/20 hover:bg-white/25 shrink-0"
                onClick={() => load()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
          {!loading && (
            <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-5 divide-x divide-white/15">
              <HeroStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Open" value={stats.open} />
              <HeroStat icon={<Clock className="h-3.5 w-3.5" />} label="Investigating" value={stats.investigating} />
              <HeroStat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Resolved" value={stats.resolved} />
              <HeroStat icon={<FileText className="h-3.5 w-3.5" />} label="In view" value={stats.total} />
              <HeroStat icon={<MapPinOff className="h-3.5 w-3.5" />} label="Arrivals" value={stats.pendingArrivals} />
            </div>
          )}
        </div>

        {/* Filters */}
        <Card className="overflow-hidden border-rose-200/50 dark:border-rose-800/30">
          <div className="h-0.5 bg-gradient-to-r from-rose-500 via-red-500 to-orange-500" />
          <CardContent className="pt-5 pb-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search order, customer, reason…"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground lg:ml-auto tabular-nums">
                {filteredDisputes.length} dispute{filteredDisputes.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Disputes table */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4 text-rose-600" />
              Order disputes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredDisputes.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-rose-600" />
                </div>
                <p className="font-medium">No disputes found</p>
                <p className="text-sm text-muted-foreground">Try another status filter or search term.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/30">
                      <TableHead>Order</TableHead>
                      <TableHead>Parties</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="min-w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDisputes.map((d) => (
                      <TableRow
                        key={d.id}
                        className="group hover:bg-rose-50/40 dark:hover:bg-rose-950/10 align-top"
                      >
                        <TableCell>
                          <Link
                            href={`/dashboard/orders/${d.orderId}`}
                            className="font-mono text-sm font-medium text-rose-700 dark:text-rose-400 hover:underline"
                          >
                            #{d.orderId.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {personName(d.order?.customer?.user)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Truck className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {personName(d.order?.driverAssignment?.driver?.user)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="text-sm line-clamp-2">{d.reason}</p>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${disputeStatusClass(d.status)}`}
                          >
                            {formatStatus(d.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.customerService?.superUser?.pseudo || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(d.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {d.status === "OPEN" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() =>
                                  void handleUpdate(d.id, {
                                    assignToMe: true,
                                    status: "INVESTIGATING",
                                  })
                                }
                              >
                                Assign
                              </Button>
                            )}
                            {d.status === "INVESTIGATING" && (
                              <Dialog
                                open={resolveDisputeId === d.id}
                                onOpenChange={(open) => {
                                  if (!open) {
                                    setResolveDisputeId(null);
                                    setResolution("");
                                  }
                                }}
                              >
                                <DialogTrigger>
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs bg-rose-600 hover:bg-rose-700"
                                    onClick={() => setResolveDisputeId(d.id)}
                                  >
                                    Resolve
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Resolve dispute</DialogTitle>
                                  </DialogHeader>
                                  <Textarea
                                    placeholder="Resolution details…"
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    rows={4}
                                  />
                                  <Button
                                    onClick={() =>
                                      void handleUpdate(d.id, {
                                        status: "RESOLVED",
                                        resolution,
                                      })
                                    }
                                  >
                                    Submit resolution
                                  </Button>
                                </DialogContent>
                              </Dialog>
                            )}
                            {(d.status === "OPEN" || d.status === "INVESTIGATING") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                onClick={() =>
                                  void handleUpdate(d.id, {
                                    status: "RESOLVED",
                                    resolution: "Marked as delivered by admin",
                                  })
                                }
                              >
                                Mark delivered
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Arrival incidents */}
        <Card className="overflow-hidden border-amber-200/40 dark:border-amber-800/30">
          <div className="h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPinOff className="h-4 w-4 text-amber-600" />
              Arrival incidents
              <Badge variant="secondary" className="font-normal ml-1">
                {arrivalConflicts.length}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              Customer rejected driver on arrival — manage in the incident desk.
            </p>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {loading ? (
              <div className="px-6 pb-6 space-y-3">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : arrivalConflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No arrival incidents.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrivalConflicts.map((c) => (
                      <TableRow
                        key={c.id}
                        className="hover:bg-amber-50/40 dark:hover:bg-amber-950/10"
                      >
                        <TableCell>
                          <Link
                            href={`/dashboard/orders/${c.orderId}`}
                            className="font-mono text-sm font-medium text-amber-800 dark:text-amber-400 hover:underline"
                          >
                            #{c.orderId.slice(0, 8)}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-[260px]">
                            {c.customerReason}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">{personName(c.customer?.user)}</TableCell>
                        <TableCell className="text-sm">{personName(c.driver?.user)}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              c.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {c.status === "PENDING" ? "Open" : formatStatus(c.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(c.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link href="/dashboard/order-arrival-conflicts">
                            <Button variant="ghost" size="sm" className="text-amber-700 gap-1">
                              Desk
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
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

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="px-3 py-3 text-center sm:px-4">
      <div className="flex items-center justify-center gap-1.5 text-rose-200 text-[10px] uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-lg sm:text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
