"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function CSOrderDetailPage() {
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
        <Card>
          <CardHeader><CardTitle>Order Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span>{order.paymentType === "COD" ? "Cash" : "Wallet"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>{order.price?.toFixed(2)} TND</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Distance</span><span>{order.distanceKm?.toFixed(1)} km</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Weight</span><span>{order.weight} kg</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>{order.customer?.user?.firstName} {order.customer?.user?.secondName}</div>
            <div className="text-muted-foreground">{order.customer?.user?.phone}</div>
          </CardContent>
        </Card>

        {order.driverAssignment && (
          <Card>
            <CardHeader><CardTitle>Driver</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>{order.driverAssignment.driver?.user?.firstName} {order.driverAssignment.driver?.user?.secondName}</div>
              <div className="text-muted-foreground">{order.driverAssignment.driver?.user?.phone}</div>
              {order.driverAssignment.acceptedAt && <div>Accepted: {new Date(order.driverAssignment.acceptedAt).toLocaleString()}</div>}
            </CardContent>
          </Card>
        )}

        {order.dispute && (
          <Card>
            <CardHeader><CardTitle>Dispute</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Badge variant="destructive">{order.dispute.status}</Badge>
              <div>{order.dispute.reason}</div>
            </CardContent>
          </Card>
        )}

        {order.chatRoom?.messages?.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Chat ({order.chatRoom.messages.length} messages)</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {order.chatRoom.messages.map((msg: any) => (
                  <div key={msg.id} className={`p-2 rounded text-sm ${msg.senderType === "CUSTOMER" ? "bg-blue-50" : "bg-green-50"}`}>
                    <span className="font-medium">{msg.senderType}: </span>{msg.content}
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
