"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`).then(r => r.json()).then(setOrder).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>;
  if (!order) return <div className="flex justify-center py-20 text-muted-foreground">Order not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-semibold">Order #{(order.id as string).slice(0, 8)}</h1>
        <Badge>{order.status?.replace(/_/g, " ")}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Info */}
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span>{order.paymentType === "COD" ? "Cash" : "Wallet"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-medium">{order.price?.toFixed(2)} TND</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Distance</span><span>{order.distanceKm?.toFixed(1)} km</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Weight</span><span>{order.weight} kg</span></div>
            {order.nightFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Night Fee</span><span>{order.nightFee?.toFixed(2)} TND</span></div>}
            {order.extraWeightFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Extra Weight Fee</span><span>{order.extraWeightFee?.toFixed(2)} TND</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{order.customer?.user?.firstName} {order.customer?.user?.secondName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{order.customer?.user?.phone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{order.customer?.user?.myEmail || "—"}</span></div>
          </CardContent>
        </Card>

        {/* Route */}
        <Card>
          <CardHeader><CardTitle>Route</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-green-600 font-medium">Pickup: </span>
              {order.pickupAddress ? `${order.pickupAddress.street || ""} ${order.pickupAddress.delegation?.nameDelegation}, ${order.pickupAddress.delegation?.governorate?.nameGovernorate}` : "—"}
            </div>
            <div>
              <span className="text-red-600 font-medium">Dropoff: </span>
              {order.dropoffAddress ? `${order.dropoffAddress.street || ""} ${order.dropoffAddress.delegation?.nameDelegation}, ${order.dropoffAddress.delegation?.governorate?.nameGovernorate}` : "—"}
            </div>
            {order.pricingPolicy?.deliveryZoneType && (
              <div><span className="text-muted-foreground">Zone: </span><Badge variant="outline">{order.pricingPolicy.deliveryZoneType.replace(/_/g, " ")}</Badge></div>
            )}
          </CardContent>
        </Card>

        {/* Driver */}
        <Card>
          <CardHeader><CardTitle>Driver</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.driverAssignment ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{order.driverAssignment.driver?.user?.firstName} {order.driverAssignment.driver?.user?.secondName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{order.driverAssignment.driver?.user?.phone}</span></div>
                {order.driverAssignment.acceptedAt && <div className="flex justify-between"><span className="text-muted-foreground">Accepted</span><span>{new Date(order.driverAssignment.acceptedAt).toLocaleString()}</span></div>}
                {order.driverAssignment.deliveredAt && <div className="flex justify-between"><span className="text-muted-foreground">Delivered</span><span>{new Date(order.driverAssignment.deliveredAt).toLocaleString()}</span></div>}
                {order.driverAssignment.image1Proof && <div><span className="text-muted-foreground">Proof 1: </span><span className="text-blue-600">Uploaded</span></div>}
                {order.driverAssignment.image2Proof && <div><span className="text-muted-foreground">Proof 2: </span><span className="text-blue-600">Uploaded</span></div>}
              </>
            ) : <p className="text-muted-foreground">No driver assigned</p>}
          </CardContent>
        </Card>

        {/* Dispute */}
        {order.dispute && (
          <Card>
            <CardHeader><CardTitle>Dispute</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="destructive">{order.dispute.status}</Badge></div>
              <div><span className="text-muted-foreground">Reason: </span>{order.dispute.reason}</div>
              {order.dispute.resolution && <div><span className="text-muted-foreground">Resolution: </span>{order.dispute.resolution}</div>}
              {order.dispute.customerService && <div><span className="text-muted-foreground">Assigned to: </span>{order.dispute.customerService.superUser.pseudo}</div>}
            </CardContent>
          </Card>
        )}

        {/* Transactions */}
        {(order.cashTransaction || order.walletTransactions?.length > 0) && (
          <Card>
            <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.cashTransaction && (
                <div>
                  <Badge variant="outline">Cash</Badge>
                  <span className="ml-2">Collected: {Number(order.cashTransaction.cashCollected).toFixed(2)} TND</span>
                  <span className="ml-2">Platform: {Number(order.cashTransaction.platformFee).toFixed(2)} TND</span>
                </div>
              )}
              {order.walletTransactions?.map((wt: any) => (
                <div key={wt.id}>
                  <Badge variant="outline">Wallet</Badge>
                  <span className="ml-2">{wt.type}: {Number(wt.amount).toFixed(2)} TND</span>
                  <Badge variant="secondary" className="ml-2">{wt.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Chat Messages */}
        {order.chatRoom?.messages?.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Chat Messages ({order.chatRoom.messages.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {order.chatRoom.messages.map((msg: any) => (
                  <div key={msg.id} className={`p-2 rounded text-sm ${msg.senderType === "CUSTOMER" ? "bg-blue-50" : msg.senderType === "DRIVER" ? "bg-green-50" : "bg-gray-50"}`}>
                    <span className="font-medium">{msg.senderType}: </span>
                    <span>{msg.content}</span>
                    <span className="text-xs text-muted-foreground ml-2">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
