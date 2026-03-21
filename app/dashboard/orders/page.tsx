"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

interface OrderRow {
  id: string; status: string; paymentType: string; price: number;
  createdAt: string; customer: { name: string; phone: string } | null;
  driver: { name: string; phone: string } | null;
  pickupAddress: string | null; dropoffAddress: string | null;
  hasDispute: boolean; disputeStatus: string | null; deliveryZoneType: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", SEARCHING_DRIVER: "outline", DRIVER_ASSIGNED: "default",
  DRIVER_ARRIVED: "default", PICKED_UP: "default", DELIVERING: "default",
  DELIVERED: "default", CANCELLED: "destructive", DISPUTED: "destructive",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = statusFilter === "ALL" ? "/api/orders" : `/api/orders?status=${statusFilter}`;
    fetch(url).then(r => r.json()).then(setOrders).finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {["SEARCHING_DRIVER","DRIVER_ASSIGNED","DRIVER_ARRIVED","PICKED_UP","DELIVERING","DELIVERED","CANCELLED","DISPUTED"].map(s => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No orders found</TableCell></TableRow>
              ) : orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/dashboard/orders/${order.id}`} className="text-blue-600 hover:underline font-mono text-sm">
                      {order.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{order.customer?.name || "—"}</TableCell>
                  <TableCell>{order.driver?.name || "—"}</TableCell>
                  <TableCell className="text-sm">
                    <div className="text-green-600">{order.pickupAddress || "—"}</div>
                    <div className="text-red-600">{order.dropoffAddress || "—"}</div>
                  </TableCell>
                  <TableCell className="font-medium">{order.price.toFixed(2)} TND</TableCell>
                  <TableCell><Badge variant="outline">{order.paymentType === "COD" ? "Cash" : "Wallet"}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[order.status] as any || "secondary"}>
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                    {order.hasDispute && <Badge variant="destructive" className="ml-1">Dispute</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
