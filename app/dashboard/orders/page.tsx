"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Package,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Truck,
  User,
  Wallet,
  Banknote,
  ChevronRight,
  CircleDot,
} from "lucide-react";

interface OrderRow {
  id: string;
  status: string;
  paymentType: string;
  price: number;
  createdAt: string;
  customer: { name: string; phone: string } | null;
  driver: { name: string; phone: string } | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  hasDispute: boolean;
  disputeStatus: string | null;
  deliveryZoneType: string | null;
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "SEARCHING_DRIVER", label: "Searching" },
  { value: "DRIVER_ASSIGNED", label: "Assigned" },
  { value: "DRIVER_ARRIVED", label: "Arrived" },
  { value: "PICKED_UP", label: "Picked up" },
  { value: "DELIVERING", label: "Delivering" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "DISPUTED", label: "Disputed" },
] as const;

const ACTIVE_STATUSES = new Set([
  "SEARCHING_DRIVER",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVED",
  "PICKED_UP",
  "DELIVERING",
]);

function statusBadgeClass(status: string): string {
  if (status === "DELIVERED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200/60";
  if (status === "CANCELLED") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200/60";
  if (status === "DISPUTED") return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200/60";
  if (ACTIVE_STATUSES.has(status)) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200/60";
  return "bg-muted text-muted-foreground border-border";
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = (filter: string) => {
    const url = filter === "ALL" ? "/api/orders" : `/api/orders?status=${filter}`;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load orders");
        return data;
      })
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((e: Error) => {
        setOrders([]);
        setError(e.message || "Failed to load orders");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders(statusFilter);
  }, [statusFilter]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const haystack = [
        o.id,
        o.customer?.name,
        o.customer?.phone,
        o.driver?.name,
        o.driver?.phone,
        o.pickupAddress,
        o.dropoffAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, search]);

  const stats = useMemo(() => {
    const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length;
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
    const disputes = orders.filter((o) => o.hasDispute).length;
    const revenue = orders
      .filter((o) => o.status === "DELIVERED")
      .reduce((sum, o) => sum + o.price, 0);
    return { total: orders.length, active, delivered, cancelled, disputes, revenue };
  }, [orders]);

  return (
    <div className="min-h-full bg-gradient-to-b from-orange-50/60 via-background to-background dark:from-orange-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-600 via-amber-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Package className="h-3.5 w-3.5" />
                  Delivery operations
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <Package className="h-8 w-8 opacity-90" />
                  Orders
                </h1>
                <p className="text-orange-100 text-sm max-w-xl">
                  Monitor live deliveries, track routes, and open order details. Filter by status or
                  search by customer, driver, or order ID.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white border-white/20 hover:bg-white/25 shrink-0"
                onClick={() => loadOrders(statusFilter)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {!loading && !error && (
            <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-5 divide-x divide-white/15">
              <StatPill label="Total" value={stats.total} />
              <StatPill label="In progress" value={stats.active} />
              <StatPill label="Delivered" value={stats.delivered} />
              <StatPill label="Cancelled" value={stats.cancelled} />
              <StatPill label="Disputes" value={stats.disputes} className="col-span-2 sm:col-span-1" />
            </div>
          )}
        </div>

        {/* Filters */}
        <Card className="overflow-hidden border-orange-200/50 dark:border-orange-800/30">
          <div className="h-0.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500" />
          <CardContent className="pt-5 pb-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ID, customer, driver, address…"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground lg:ml-auto tabular-nums">
                {filteredOrders.length} of {orders.length} shown
                {statusFilter !== "ALL" && ` · filter: ${formatStatus(statusFilter)}`}
              </p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-orange-600" />
              Order list
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-700 dark:text-red-300 border-b bg-red-50 dark:bg-red-950/30">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                  <Package className="h-7 w-7 text-orange-600" />
                </div>
                <p className="font-medium">No orders found</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {search
                    ? "Try a different search term or clear the status filter."
                    : "Orders will appear here when customers place deliveries."}
                </p>
                {(search || statusFilter !== "ALL") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead className="min-w-[200px]">Route</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="group hover:bg-orange-50/40 dark:hover:bg-orange-950/15 transition-colors"
                      >
                        <TableCell>
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="font-mono text-sm font-medium text-orange-700 dark:text-orange-400 hover:underline"
                          >
                            #{order.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {order.customer ? (
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {order.customer.name || "—"}
                              </div>
                              {order.customer.phone && (
                                <p className="text-xs text-muted-foreground pl-5">{order.customer.phone}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.driver ? (
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-sm truncate">
                                <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {order.driver.name || "—"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs max-w-[240px]">
                            <div className="flex items-start gap-1.5">
                              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="text-muted-foreground line-clamp-2">
                                {order.pickupAddress || "—"}
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <ArrowDownRight className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <span className="text-muted-foreground line-clamp-2">
                                {order.dropoffAddress || "—"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold tabular-nums">{order.price.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground ml-1">TND</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="gap-1 font-normal text-xs"
                          >
                            {order.paymentType === "COD" ? (
                              <><Banknote className="h-3 w-3" /> Cash</>
                            ) : (
                              <><Wallet className="h-3 w-3" /> Wallet</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(order.status)}`}
                            >
                              {formatStatus(order.status)}
                            </span>
                            {order.hasDispute && (
                              <Badge variant="destructive" className="text-[10px] px-1.5">
                                Dispute
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="inline-flex opacity-0 group-hover:opacity-100 transition-opacity text-orange-600"
                          >
                            <ChevronRight className="h-4 w-4" />
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

        {!loading && stats.delivered > 0 && statusFilter === "ALL" && !search && (
          <p className="text-xs text-center text-muted-foreground pb-2">
            Delivered revenue in current view:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {stats.revenue.toFixed(2)} TND
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`px-4 py-3 text-center sm:px-5 ${className}`}>
      <p className="text-[10px] uppercase tracking-wide text-orange-200">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5">{value.toLocaleString()}</p>
    </div>
  );
}
