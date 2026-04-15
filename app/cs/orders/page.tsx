"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

type CSOrderRow = {
  id: string;
  status: string;
  price: number;
  createdAt: string;
  customer?: { name?: string } | null;
  driver?: { name?: string } | null;
};

export default function CSOrdersPage() {
  const [orders, setOrders] = useState<CSOrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => {
        const canView = me.role === "ADMIN" || (me.csRoles || []).includes("VIEW_DELIVERIES");
        setAllowed(canView);
        if (!canView) setLoading(false);
      })
      .catch(() => {
        setAllowed(false);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (allowed !== true) return;
    const url = statusFilter === "ALL" ? "/api/orders" : `/api/orders?status=${statusFilter}`;
    fetch(url).then(r => r.json()).then(setOrders).finally(() => setLoading(false));
  }, [allowed, statusFilter]);

  if (allowed === false) {
    return <div className="text-sm text-red-500">Access denied. VIEW_DELIVERIES permission is required.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {["SEARCHING_DRIVER","DRIVER_ASSIGNED","DELIVERING","DELIVERED","CANCELLED","DISPUTED"].map(s => (
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
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders</TableCell></TableRow>
              ) : orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/cs/orders/${o.id}`} className="text-blue-600 hover:underline font-mono text-sm">{o.id.slice(0, 8)}</Link>
                  </TableCell>
                  <TableCell>{o.customer?.name || "—"}</TableCell>
                  <TableCell>{o.driver?.name || "—"}</TableCell>
                  <TableCell className="font-medium">{o.price.toFixed(2)} TND</TableCell>
                  <TableCell>
                    <Badge variant={o.status === "DELIVERED" ? "default" : o.status === "CANCELLED" || o.status === "DISPUTED" ? "destructive" : "secondary"}>
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
