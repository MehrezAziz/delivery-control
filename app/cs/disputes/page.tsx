"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { toast } from "sonner";

export default function CSDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [resolution, setResolution] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [refunding, setRefunding] = useState(false);

  const load = () => {
    const url = filter === "ALL" ? "/api/disputes" : `/api/disputes?status=${filter}`;
    fetch(url).then(r => r.json()).then(setDisputes).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleUpdate = async (id: string, data: any) => {
    try {
      await fetch(`/api/disputes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      toast.success("Dispute updated");
      load();
    } catch { toast.error("Failed to update"); }
  };

  const handleRefund = async (id: string) => {
    setRefunding(true);
    try {
      const res = await fetch(`/api/disputes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refund: true }) });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.type === "REFUND" ? "Refunded" : "Compensated"} ${data.amount} coins`);
        load();
      } else {
        toast.error(data.error || "Refund failed");
      }
    } catch { toast.error("Refund failed"); }
    finally { setRefunding(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Disputes</h1>
      <div className="flex gap-2 flex-wrap">
        {["ALL", "OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"].map(s => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm"
            onClick={() => { setLoading(true); setFilter(s); }}>{s.replace("_", " ")}</Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : disputes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No disputes</TableCell></TableRow>
              ) : disputes.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link href={`/cs/orders/${d.orderId}`} className="text-blue-600 hover:underline font-mono text-sm">{d.orderId.slice(0, 8)}</Link>
                  </TableCell>
                  <TableCell>{d.order?.customer?.user?.firstName} {d.order?.customer?.user?.secondName}</TableCell>
                  <TableCell>
                    <Badge variant={d.order?.paymentType === "COD" ? "outline" : "secondary"}>
                      {d.order?.paymentType === "COD" ? "💵 Cash" : "💰 Wallet"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{d.reason}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "OPEN" ? "destructive" : d.status === "RESOLVED" ? "default" : "secondary"}>{d.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{d.resolution || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {d.status === "OPEN" && (
                        <Button size="sm" variant="outline" onClick={() => handleUpdate(d.id, { assignToMe: true, status: "INVESTIGATING" })}>
                          Assign & Investigate
                        </Button>
                      )}
                      {d.status === "INVESTIGATING" && (
                        <>
                          <Dialog>
                            <DialogTrigger><Button size="sm" onClick={() => setSelectedId(d.id)}>Resolve</Button></DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>Resolve Dispute</DialogTitle></DialogHeader>
                              <Textarea placeholder="Resolution details..." value={resolution} onChange={e => setResolution(e.target.value)} />
                              <Button onClick={() => { handleUpdate(selectedId, { status: "RESOLVED", resolution }); setResolution(""); }}>Submit Resolution</Button>
                            </DialogContent>
                          </Dialog>
                          <Button size="sm" variant="destructive" disabled={refunding}
                            onClick={() => handleRefund(d.id)}>
                            {refunding ? "Processing..." : d.order?.paymentType === "COD" ? "💰 Compensate Coins" : "💰 Refund Coins"}
                          </Button>
                        </>
                      )}
                      {(d.status === "OPEN" || d.status === "INVESTIGATING") && (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300"
                          onClick={() => handleUpdate(d.id, { status: "RESOLVED", resolution: "Marked as delivered" })}>
                          Mark Delivered
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
