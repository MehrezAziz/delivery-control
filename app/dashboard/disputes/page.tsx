"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { toast } from "sonner";

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const load = () => {
    const url = statusFilter === "ALL" ? "/api/disputes" : `/api/disputes?status=${statusFilter}`;
    fetch(url).then(r => r.json()).then(setDisputes).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleUpdate = async (id: string, data: any) => {
    try {
      await fetch(`/api/disputes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      toast.success("Dispute updated");
      load();
    } catch { toast.error("Failed to update dispute"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Disputes</h1>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
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
                    <Link href={`/dashboard/orders/${d.orderId}`} className="text-blue-600 hover:underline font-mono text-sm">{d.orderId.slice(0, 8)}</Link>
                  </TableCell>
                  <TableCell>{d.order?.customer?.user?.firstName} {d.order?.customer?.user?.secondName}</TableCell>
                  <TableCell>{d.order?.driverAssignment?.driver?.user?.firstName || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{d.reason}</TableCell>
                  <TableCell><Badge variant={d.status === "OPEN" ? "destructive" : d.status === "RESOLVED" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                  <TableCell>{d.customerService?.superUser?.pseudo || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {d.status === "OPEN" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleUpdate(d.id, { assignToMe: true, status: "INVESTIGATING" })}>Assign & Investigate</Button>
                        </>
                      )}
                      {d.status === "INVESTIGATING" && (
                        <Dialog>
                          <DialogTrigger><Button size="sm" onClick={() => setSelectedId(d.id)}>Resolve</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Resolve Dispute</DialogTitle></DialogHeader>
                            <Textarea placeholder="Resolution details..." value={resolution} onChange={e => setResolution(e.target.value)} />
                            <Button onClick={() => { handleUpdate(selectedId, { status: "RESOLVED", resolution }); setResolution(""); }}>Submit Resolution</Button>
                          </DialogContent>
                        </Dialog>
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
