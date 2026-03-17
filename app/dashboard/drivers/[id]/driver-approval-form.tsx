"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DriverApprovalForm({ driverId, userId, currentStatus, hasDocuments }: { driverId: string; userId: string; currentStatus: string; hasDocuments: boolean }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleAction(action: "approve" | "reject") {
    setError("");
    if (action === "reject" && !reason.trim()) { setError("Please provide a reason for rejection."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/drivers/${driverId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, userId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }
      router.push("/dashboard/drivers");
    } finally { setLoading(false); }
  }

  const canApprove = hasDocuments && currentStatus !== "VERIFIED";
  const canReject = currentStatus !== "REJECTED";

  return (
    <Card>
      <CardHeader><CardTitle>Approval Decision</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Reason / Description (required for rejection)</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for approval or rejection..." />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={() => handleAction("approve")} disabled={loading || !canApprove} className="bg-green-600 hover:bg-green-700">
            {loading ? "Processing..." : "Approve"}
          </Button>
          <Button onClick={() => handleAction("reject")} disabled={loading || !canReject} variant="destructive">
            {loading ? "Processing..." : "Reject"}
          </Button>
        </div>
        {!hasDocuments && <p className="text-xs text-muted-foreground">Cannot approve without documents.</p>}
      </CardContent>
    </Card>
  );
}
