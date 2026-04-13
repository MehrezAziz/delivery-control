"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export function OrderArrivalConflictsView(props: {
  listUrl: string;
  /** e.g. `/api/cs/order-arrival-conflicts` → PATCH `${prefix}/${id}/resolve` */
  resolveUrlPrefix: string;
  orderDetailPrefix: string;
}) {
  const { listUrl, resolveUrlPrefix, orderDetailPrefix } = props;
  const [filter, setFilter] = useState<string>("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [reasonTargetId, setReasonTargetId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<"FORGIVE" | "SUSPEND_CUSTOMER" | "SUSPEND_DRIVER" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`${listUrl}${q}`, { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRows(data.conflicts || []);
    } catch (e: any) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [filter, listUrl]);

  useEffect(() => {
    void load();
  }, [load]);

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
    } catch (e: any) {
      alert(e.message || "Error");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Arrival incidents</h1>
      <p className="text-sm text-muted-foreground max-w-3xl">
        When a customer rejects a driver after arrival, both sides can leave a statement. Use the actions below to record
        a decision (forgive, suspend customer, or suspend driver).
      </p>

      <div className="flex flex-wrap gap-2">
        {["PENDING", "RESOLVED_FORGIVE", "RESOLVED_SUSPEND_CUSTOMER", "RESOLVED_SUSPEND_DRIVER", ""].map((f) => (
          <Button
            key={f || "all"}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f ? f.replace(/_/g, " ") : "All"}
          </Button>
        ))}
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Incidents ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Statements</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const custName =
                    `${r.customer?.user?.firstName || ""} ${r.customer?.user?.secondName || ""}`.trim() || "—";
                  const drvName =
                    `${r.driver?.user?.firstName || ""} ${r.driver?.user?.secondName || ""}`.trim() || "—";
                  const area = r.order.pickupAddress
                    ? `${r.order.pickupAddress.delegation.nameDelegation}, ${r.order.pickupAddress.delegation.governorate.nameGovernorate}`
                    : "—";
                  const busy = acting?.startsWith(r.id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link className="text-primary underline" href={`${orderDetailPrefix}/${r.order.id}`}>
                          {r.order.id.slice(0, 8)}…
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.order.status}</div>
                      </TableCell>
                      <TableCell className="max-w-[140px] text-xs">{area}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {custName}
                        <div className="text-xs text-muted-foreground">{r.customer?.user?.phone}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {drvName}
                        <div className="text-xs text-muted-foreground">{r.driver?.user?.phone}</div>
                      </TableCell>
                      <TableCell className="max-w-[280px] text-xs space-y-1">
                        <div>
                          <span className="font-semibold">Customer: </span>
                          {r.customerReason}
                        </div>
                        {r.driverFeedback && (
                          <div>
                            <span className="font-semibold">Driver: </span>
                            {r.driverFeedback}
                          </div>
                        )}
                        <div className="text-muted-foreground">
                          Note: {r.resolutionNote || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "PENDING" ? (
                          <div className="flex flex-col gap-1 items-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!!acting}
                              onClick={() => openReasonDialog(r.id, "FORGIVE", r.resolutionNote)}
                            >
                              {busy && acting?.endsWith("FORGIVE") ? "…" : "Forgive"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={!!acting}
                              onClick={() => openReasonDialog(r.id, "SUSPEND_CUSTOMER", r.resolutionNote)}
                            >
                              {busy && acting?.endsWith("SUSPEND_CUSTOMER") ? "…" : "Suspend customer"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={!!acting}
                              onClick={() => openReasonDialog(r.id, "SUSPEND_DRIVER", r.resolutionNote)}
                            >
                              {busy && acting?.endsWith("SUSPEND_DRIVER") ? "…" : "Suspend driver"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!acting}
                              onClick={() => openReasonDialog(r.id, null, r.resolutionNote)}
                            >
                              {acting === r.id + "NOTE" ? "…" : "Edit reason"}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-xs text-muted-foreground">Closed</span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!acting}
                              onClick={() => openReasonDialog(r.id, null, r.resolutionNote)}
                            >
                              {acting === r.id + "NOTE" ? "…" : "Edit reason"}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reasonAction ? "Decision reason (optional)" : "Update reason"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Write a reason or note..."
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
  );
}
