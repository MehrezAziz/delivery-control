"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CustomerStatusIndicator } from "@/components/customer-status-indicator";

interface Address {
  id: string;
  street: string | null;
  delegation: string;
  governorate: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

interface Restriction {
  id: string;
  type: string;
  reason: string;
  startDate: string;
  endDate: string | null;
  liftedAt: string | null;
}

interface CustomerDetail {
  id: string;
  userId: string;
  firstName: string | null;
  secondName: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  customerStatus: string;
  completedOrders: number;
  createdAt: string;
  addresses: Address[];
  restrictions: Restriction[];
}

interface MeData {
  csRoles: string[];
}

const customerStatuses = ["CREATED", "VERIFIED", "ACTIVE", "SUSPENDED", "BLOCKED"];

export default function CSCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Status form state
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/cs/customers/${id}`).then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error); });
        return r.json();
      }),
      fetch("/api/auth/me").then(r => r.json()),
    ])
      .then(([cust, meData]) => {
        setCustomer(cust);
        setNewStatus(cust.customerStatus);
        setMe(meData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const canUpdateStatus = me?.csRoles?.includes("UPDATE_CUSTOMER_STATUS") ?? false;

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setUpdateError("");

    if (["SUSPENDED", "BLOCKED"].includes(newStatus) && !reason.trim()) {
      setUpdateError("Reason is required for this status change.");
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/cs/customers/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setUpdateError(data.error || "Failed to update"); return; }
      // Refresh data
      const updated = await fetch(`/api/cs/customers/${id}`).then(r => r.json());
      setCustomer(updated);
      setNewStatus(updated.customerStatus);
      setReason("");
    } finally { setUpdating(false); }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return (
    <Card><CardContent className="py-8"><p className="text-sm text-red-500 text-center">{error}</p></CardContent></Card>
  );
  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Customer Details</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/cs/customers")}>← Back</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><span className="text-sm text-muted-foreground">Name:</span> <span className="ml-2">{customer.firstName} {customer.secondName}</span></div>
          <div><span className="text-sm text-muted-foreground">Phone:</span> <span className="ml-2">{customer.phone || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Email:</span> <span className="ml-2">{customer.email || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Gender:</span> <span className="ml-2">{customer.gender || "-"}</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <CustomerStatusIndicator status={customer.customerStatus} />
          </div>
          <div><span className="text-sm text-muted-foreground">Orders:</span> <span className="ml-2">{customer.completedOrders}</span></div>
          <div><span className="text-sm text-muted-foreground">Created:</span> <span className="ml-2">{new Date(customer.createdAt).toLocaleDateString()}</span></div>
        </CardContent>
      </Card>

      {customer.addresses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Addresses ({customer.addresses.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customer.addresses.map((addr, i) => (
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
              <div className="flex gap-3 items-end flex-wrap">
                <Select value={newStatus} onValueChange={(v) => { if (v) setNewStatus(v); }}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {customerStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(newStatus === "SUSPENDED" || newStatus === "BLOCKED") && (
                <div className="space-y-2">
                  <Label>Reason (required)</Label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this action..." required />
                </div>
              )}
              {updateError && <p className="text-sm text-red-500">{updateError}</p>}
              <Button type="submit" disabled={updating || newStatus === customer.customerStatus}>
                {updating ? "Updating..." : "Update Status"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {customer.restrictions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Restrictions History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customer.restrictions.map(r => (
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
