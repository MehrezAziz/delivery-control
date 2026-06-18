"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Package,
  User,
  Truck,
  MapPin,
  CreditCard,
  AlertTriangle,
  MessageSquare,
  Clock,
  Navigation,
} from "lucide-react";

function orderStatusClass(status: string) {
  if (status === "DELIVERED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "CANCELLED" || status === "FAILED") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (status === "DELIVERING" || status === "DRIVER_ASSIGNED") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  return "bg-muted text-muted-foreground";
}

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5">
      <span className="text-muted-foreground text-sm shrink-0">{label}</span>
      <span className={cn("text-sm text-right", highlight && "font-semibold tabular-nums")}>{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/orders/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load order");
        return data;
      })
      .then(setOrder)
      .catch((e: any) => setError(e.message || "Failed to load order"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-orange-50/50 via-background to-background dark:from-orange-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-gradient-to-b from-orange-50/50 via-background to-background dark:from-orange-950/10 p-6">
        <Card className="max-w-lg mx-auto border-red-200">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <p className="text-red-600">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">Order not found</div>
    );
  }

  const shortId = (order.id as string).slice(0, 8);
  const status = order.status || "UNKNOWN";

  return (
    <div className="min-h-full bg-gradient-to-b from-orange-50/50 via-background to-background dark:from-orange-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-600 via-amber-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "bg-white/15 text-white border-white/20 hover:bg-white/25",
                    )}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                    Back
                  </button>
                  <Link
                    href="/dashboard/orders"
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "bg-white/10 text-white/90 border-white/15 hover:bg-white/20",
                    )}
                  >
                    All orders
                  </Link>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <Package className="h-8 w-8 opacity-90" />
                  Order #{shortId}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn("border-0", orderStatusClass(status))}>
                    {status.replace(/_/g, " ")}
                  </Badge>
                  <Badge className="bg-white/15 text-white border-white/20">
                    {order.paymentType === "COD" ? "Cash on delivery" : "Wallet"}
                  </Badge>
                  {order.pricingPolicy?.deliveryZoneType && (
                    <Badge className="bg-white/10 text-white/95 border-white/15">
                      {order.pricingPolicy.deliveryZoneType.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-orange-200 text-xs uppercase tracking-wide">Total price</p>
                <p className="text-3xl font-bold tabular-nums">{order.price?.toFixed(2)} TND</p>
              </div>
            </div>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/15">
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-orange-200">Distance</p>
              <p className="text-lg font-bold tabular-nums">{order.distanceKm?.toFixed(1) ?? "—"} km</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-orange-200">Weight</p>
              <p className="text-lg font-bold tabular-nums">{order.weight ?? "—"} kg</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-orange-200">Driver</p>
              <p className="text-sm font-semibold mt-0.5">{order.driverAssignment ? "Assigned" : "None"}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-orange-200">Created</p>
              <p className="text-xs font-semibold mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="overflow-hidden border-orange-200/40 dark:border-orange-800/30">
            <div className="h-0.5 bg-gradient-to-r from-orange-500 to-amber-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" />
                Order details
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="Payment" value={order.paymentType === "COD" ? "Cash" : "Wallet"} />
              <InfoRow label="Price" value={`${order.price?.toFixed(2)} TND`} highlight />
              <InfoRow label="Distance" value={`${order.distanceKm?.toFixed(1)} km`} />
              <InfoRow label="Weight" value={`${order.weight} kg`} />
              {order.nightFee > 0 && <InfoRow label="Night fee" value={`${order.nightFee?.toFixed(2)} TND`} />}
              {order.extraWeightFee > 0 && (
                <InfoRow label="Extra weight fee" value={`${order.extraWeightFee?.toFixed(2)} TND`} />
              )}
              <InfoRow
                label="Created"
                value={
                  <span className="flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" />
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                }
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-violet-600" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow
                label="Name"
                value={`${order.customer?.user?.firstName ?? ""} ${order.customer?.user?.secondName ?? ""}`.trim() || "—"}
              />
              <InfoRow label="Phone" value={order.customer?.user?.phone || "—"} />
              <InfoRow label="Email" value={order.customer?.user?.myEmail || "—"} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="h-4 w-4 text-emerald-600" />
                Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Pickup
                </p>
                <p>
                  {order.pickupAddress
                    ? `${order.pickupAddress.street || ""} ${order.pickupAddress.delegation?.nameDelegation}, ${order.pickupAddress.delegation?.governorate?.nameGovernorate}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border bg-rose-50/50 dark:bg-rose-950/20 p-3">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Dropoff
                </p>
                <p>
                  {order.dropoffAddress
                    ? `${order.dropoffAddress.street || ""} ${order.dropoffAddress.delegation?.nameDelegation}, ${order.dropoffAddress.delegation?.governorate?.nameGovernorate}`
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-sky-500 to-blue-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-sky-600" />
                Driver
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.driverAssignment ? (
                <div className="divide-y">
                  <InfoRow
                    label="Name"
                    value={`${order.driverAssignment.driver?.user?.firstName ?? ""} ${order.driverAssignment.driver?.user?.secondName ?? ""}`.trim()}
                  />
                  <InfoRow label="Phone" value={order.driverAssignment.driver?.user?.phone || "—"} />
                  {order.driverAssignment.acceptedAt && (
                    <InfoRow label="Accepted" value={new Date(order.driverAssignment.acceptedAt).toLocaleString()} />
                  )}
                  {order.driverAssignment.deliveredAt && (
                    <InfoRow label="Delivered" value={new Date(order.driverAssignment.deliveredAt).toLocaleString()} />
                  )}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {order.driverAssignment.image1Proof && (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300">Proof 1 ✓</Badge>
                    )}
                    {order.driverAssignment.image2Proof && (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-300">Proof 2 ✓</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No driver assigned yet</p>
              )}
            </CardContent>
          </Card>

          {order.dispute && (
            <Card className="overflow-hidden border-red-200/50 md:col-span-2">
              <div className="h-0.5 bg-gradient-to-r from-red-500 to-rose-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Dispute
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{order.dispute.status}</Badge>
                  {order.dispute.customerService && (
                    <span className="text-muted-foreground">
                      Assigned: {order.dispute.customerService.superUser.pseudo}
                    </span>
                  )}
                </div>
                <p><span className="font-medium">Reason:</span> {order.dispute.reason}</p>
                {order.dispute.resolution && (
                  <p><span className="font-medium">Resolution:</span> {order.dispute.resolution}</p>
                )}
              </CardContent>
            </Card>
          )}

          {(order.cashTransaction || order.walletTransactions?.length > 0) && (
            <Card className="overflow-hidden md:col-span-2">
              <div className="h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-cyan-600" />
                  Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.cashTransaction && (
                  <div className="rounded-xl border p-3 flex flex-wrap items-center gap-3 text-sm">
                    <Badge variant="outline">Cash</Badge>
                    <span>Collected: <strong>{Number(order.cashTransaction.cashCollected).toFixed(2)} TND</strong></span>
                    <span className="text-muted-foreground">Platform: {Number(order.cashTransaction.platformFee).toFixed(2)} TND</span>
                  </div>
                )}
                {order.walletTransactions?.map((wt: any) => (
                  <div key={wt.id} className="rounded-xl border p-3 flex flex-wrap items-center gap-3 text-sm">
                    <Badge variant="outline">Wallet</Badge>
                    <span>{wt.type}: <strong>{Number(wt.amount).toFixed(2)} TND</strong></span>
                    <Badge variant="secondary">{wt.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Array.isArray(order.chatRoomsHistory) && order.chatRoomsHistory.length > 0 && (
            <Card className="overflow-hidden md:col-span-2">
              <div className="h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-600" />
                  Chat history ({order.chatRoomsHistory.length} rooms)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.chatRoomsHistory.map((room: any) => (
                  <div key={room.id} className="rounded-xl border overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 text-sm border-b">
                      <Badge variant={room.status === "ACTIVE" ? "default" : "secondary"}>{room.status}</Badge>
                      <span className="text-muted-foreground">Driver:</span>
                      <span className="font-medium">{room.driver?.name || "Unknown"}</span>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {new Date(room.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="max-h-52 overflow-y-auto p-3 space-y-2">
                      {(room.messages || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No messages</p>
                      ) : (
                        (room.messages || []).map((msg: any) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "p-2.5 rounded-lg text-sm",
                              msg.senderType === "CUSTOMER"
                                ? "bg-blue-50 dark:bg-blue-950/30"
                                : msg.senderType === "DRIVER"
                                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                                  : "bg-muted/50",
                            )}
                          >
                            <span className="font-medium text-xs text-muted-foreground">{msg.senderType}</span>
                            <p className="mt-0.5">{msg.content}</p>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
