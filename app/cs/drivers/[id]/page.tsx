"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Address {
  id: string; street: string | null; delegation: string; governorate: string; country: string;
  latitude: number | null; longitude: number | null;
}
interface Restriction {
  id: string; type: string; reason: string; startDate: string; endDate: string | null; liftedAt: string | null;
}
interface DriverDetail {
  id: string; userId: string; firstName: string | null; secondName: string | null;
  phone: string | null; email: string | null; gender: string | null;
  vehicleType: string | null; status: string; approvedAt: string | null;
  description: string | null; createdAt: string; hasDocuments: boolean;
  addresses: Address[]; restrictions: Restriction[];
  account: { balance: number; completedDeliveries: number; negativeBalanceSince?: string; daysRemainingToPay?: number; maxNegativeDays?: number } | null;
  performance: { totalOrders: number; completedOrders: number; cancelledOrders: number; avgRating: number | null; completionRate: number | null } | null;
}
interface MeData { csRoles: string[] }

const driverStatuses = ["INCOMPLETE", "PENDING_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED", "PAUSED"];

export default function CSDriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/cs/drivers/${id}`).then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error); });
        return r.json();
      }),
      fetch("/api/auth/me").then(r => r.json()),
    ])
      .then(([drv, meData]) => { setDriver(drv); setNewStatus(drv.status); setMe(meData); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const canUpdateStatus = me?.csRoles?.includes("UPDATE_DRIVER_STATUS") ?? false;

  const availableStatuses = driver?.hasDocuments
    ? driverStatuses.filter(s => s !== "INCOMPLETE")
    : driverStatuses;

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!driver) return;
    setUpdateError("");
    if (["SUSPENDED", "REJECTED"].includes(newStatus) && !reason.trim()) {
      setUpdateError("Reason is required for this status change.");
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/api/cs/drivers/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setUpdateError(data.error || "Failed to update"); return; }
      const updated = await fetch(`/api/cs/drivers/${id}`).then(r => r.json());
      setDriver(updated);
      setNewStatus(updated.status);
      setReason("");
    } finally { setUpdating(false); }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return <Card><CardContent className="py-8"><p className="text-sm text-red-500 text-center">{error}</p></CardContent></Card>;
  if (!driver) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Driver Details</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/cs/drivers")}>← Back</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><span className="text-sm text-muted-foreground">Name:</span> <span className="ml-2">{driver.firstName} {driver.secondName}</span></div>
          <div><span className="text-sm text-muted-foreground">Phone:</span> <span className="ml-2">{driver.phone || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Email:</span> <span className="ml-2">{driver.email || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Gender:</span> <span className="ml-2">{driver.gender || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Vehicle:</span> <span className="ml-2">{driver.vehicleType || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Status:</span> <Badge className="ml-2">{driver.status}</Badge></div>
          <div><span className="text-sm text-muted-foreground">Approved:</span> <span className="ml-2">{driver.approvedAt ? new Date(driver.approvedAt).toLocaleDateString() : "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Created:</span> <span className="ml-2">{new Date(driver.createdAt).toLocaleDateString()}</span></div>
        </CardContent>
      </Card>

      {driver.account && (
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><span className="text-sm text-muted-foreground">Balance:</span> <span className={`ml-2 font-semibold ${Number(driver.account.balance) < 0 ? 'text-red-600' : 'text-green-600'}`}>{driver.account.balance} TND</span></div>
            <div><span className="text-sm text-muted-foreground">Completed Deliveries:</span> <span className="ml-2">{driver.account.completedDeliveries}</span></div>
          </CardContent>
          {driver.account.daysRemainingToPay !== undefined && Number(driver.account.balance) < 0 && (
            <CardContent className="pt-0">
              <div className={`rounded-lg p-3 ${driver.account.daysRemainingToPay <= 0 ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{driver.account.daysRemainingToPay <= 0 ? '🚫' : '⚠️'}</span>
                  <div>
                    {driver.account.daysRemainingToPay <= 0 ? (
                      <p className="text-sm font-semibold text-red-700">Account Paused — exceeded {driver.account.maxNegativeDays} days with negative balance</p>
                    ) : (
                      <p className="text-sm font-semibold text-orange-700">{driver.account.daysRemainingToPay} day{driver.account.daysRemainingToPay !== 1 ? 's' : ''} remaining to pay fees (max {driver.account.maxNegativeDays} days)</p>
                    )}
                    {driver.account.negativeBalanceSince && (
                      <p className="text-xs text-muted-foreground mt-1">Negative since: {new Date(driver.account.negativeBalanceSince).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {driver.performance && (
        <Card>
          <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><span className="text-sm text-muted-foreground">Total Orders:</span> <span className="ml-2">{driver.performance.totalOrders}</span></div>
            <div><span className="text-sm text-muted-foreground">Completed:</span> <span className="ml-2">{driver.performance.completedOrders}</span></div>
            <div><span className="text-sm text-muted-foreground">Cancelled:</span> <span className="ml-2">{driver.performance.cancelledOrders}</span></div>
            <div><span className="text-sm text-muted-foreground">Avg Rating:</span> <span className="ml-2">{driver.performance.avgRating ?? "-"}</span></div>
            <div><span className="text-sm text-muted-foreground">Completion Rate:</span> <span className="ml-2">{driver.performance.completionRate ? `${driver.performance.completionRate}%` : "-"}</span></div>
          </CardContent>
        </Card>
      )}

      {driver.addresses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Addresses ({driver.addresses.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {driver.addresses.map((addr, i) => (
                <div key={addr.id} className="border rounded p-3 text-sm">
                  <div className="font-medium">Address {i + 1}</div>
                  <div className="grid gap-2 sm:grid-cols-2 mt-2 text-muted-foreground">
                    <div>Street: {addr.street || "-"}</div>
                    <div>Delegation: {addr.delegation}</div>
                    <div>Governorate: {addr.governorate}</div>
                    <div>Country: {addr.country}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {canUpdateStatus && (
        <Card>
          <CardHeader><CardTitle>Update Status</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleStatusUpdate} className="space-y-3">
              <Select value={newStatus} onValueChange={(v) => { if (v) setNewStatus(v); }}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {(newStatus === "SUSPENDED" || newStatus === "REJECTED") && (
                <div className="space-y-2">
                  <Label>Reason (required)</Label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this action..." required />
                </div>
              )}
              {updateError && <p className="text-sm text-red-500">{updateError}</p>}
              <Button type="submit" disabled={updating || newStatus === driver.status}>
                {updating ? "Updating..." : "Update Status"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {driver.restrictions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Restrictions History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {driver.restrictions.map(r => (
                <div key={r.id} className="border rounded p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.liftedAt ? "secondary" : "destructive"}>{r.type}</Badge>
                    {r.liftedAt && <span className="text-xs text-muted-foreground">(Lifted)</span>}
                  </div>
                  <p className="text-sm mt-1">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.startDate).toLocaleDateString()} - {r.endDate ? new Date(r.endDate).toLocaleDateString() : "Permanent"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
