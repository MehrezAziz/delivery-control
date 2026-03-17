"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const customerStatuses = ["CREATED", "VERIFIED", "ACTIVE", "SUSPENDED", "BLOCKED"];
const driverStatuses = ["INCOMPLETE", "PENDING_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"];

export default function UserStatusForm({ userId, userType, currentStatus, hasDocuments = false }: { userId: string; userType: "customer" | "driver"; currentStatus: string; hasDocuments?: boolean }) {
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Filter statuses based on rules
  let availableStatuses: string[];
  if (userType === "customer") {
    // Customer: can go from ACTIVE/CREATED to SUSPENDED/BLOCKED and vice versa
    if (["ACTIVE", "CREATED", "VERIFIED"].includes(currentStatus)) {
      availableStatuses = ["CREATED", "VERIFIED", "ACTIVE", "SUSPENDED", "BLOCKED"];
    } else {
      // From SUSPENDED/BLOCKED can go back to ACTIVE/CREATED
      availableStatuses = ["CREATED", "ACTIVE", "SUSPENDED", "BLOCKED"];
    }
  } else {
    // Driver: can't change to INCOMPLETE if has documents
    availableStatuses = hasDocuments
      ? driverStatuses.filter(s => s !== "INCOMPLETE")
      : driverStatuses;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate: driver with documents can't go to INCOMPLETE
    if (userType === "driver" && status === "INCOMPLETE" && hasDocuments) {
      setError("Cannot set status to INCOMPLETE when driver has submitted documents.");
      return;
    }

    // Validate: reason required for restrictions
    if (["SUSPENDED", "BLOCKED", "REJECTED"].includes(status) && !reason.trim()) {
      setError("Reason is required for this status change.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, userType, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to update"); return; }
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label>Change Status</Label>
      <div className="flex gap-3 items-end flex-wrap">
        <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {(status === "SUSPENDED" || status === "BLOCKED" || status === "REJECTED") && (
        <div className="space-y-2">
          <Label>Reason (required for restriction)</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this action..." required />
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading || status === currentStatus}>
        {loading ? "Updating..." : "Update Status"}
      </Button>
    </form>
  );
}
