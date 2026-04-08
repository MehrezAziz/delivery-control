"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type VerificationDoc = {
  id: string;
  verificationStatus: string;
  selfieImage: string | null;
  docImageTop: string | null;
  docImageBottom: string | null;
  selfieVerified: boolean;
  mlAnalysis: Record<string, unknown> | null;
  firstName: string | null;
  lastName: string | null;
  idNumber: string | null;
  dateOfBirth: string | null;
};

type VerificationHistoryItem = {
  id: string;
  documentType: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  documents: VerificationDoc[];
};

function toImageUrl(src: string): string {
  return `/api/images/${src.replace(/\\/g, "/")}`;
}

function parseRecommendation(ml: Record<string, unknown> | null): {
  recommendation?: string;
  stage?: string;
  reasons: string[];
  textScore?: number;
  faceSimilarity?: number;
  livenessPassed?: boolean;
} {
  if (!ml) return { reasons: [] };

  const reasons =
    Array.isArray(ml.reasons) ? ml.reasons.filter((x): x is string => typeof x === "string") : [];
  const recommendation =
    typeof ml.recommendation === "string"
      ? ml.recommendation
      : typeof ml.decision === "string"
        ? ml.decision
        : undefined;
  const textScore = typeof ml.textScore === "number" ? ml.textScore : undefined;
  const faceSimilarity = typeof ml.faceSimilarity === "number" ? ml.faceSimilarity : undefined;
  const livenessPassed = typeof ml.livenessPassed === "boolean" ? ml.livenessPassed : undefined;
  const stage = typeof ml.stage === "string" ? ml.stage : undefined;

  return { recommendation, stage, reasons, textScore, faceSimilarity, livenessPassed };
}

export default function DriverVerificationHistoryViewer({
  driverId,
}: {
  driverId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<VerificationHistoryItem[] | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/staff/drivers/${driverId}/verification-history`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load verification history");
        return;
      }
      setHistory(data.history || []);
    } catch {
      setError("Network error while loading verification history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, [driverId]);

  async function handleDecision(action: "approve" | "reject") {
    setActionError("");
    setActionMessage("");
    if (action === "reject" && !reason.trim()) {
      setActionError("Reason is required for rejection.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/staff/drivers/${driverId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to apply decision");
        return;
      }
      setActionMessage(
        action === "approve"
          ? "Driver approved successfully."
          : "Driver rejected and reason recorded.",
      );
      await loadHistory();
    } catch {
      setActionError("Network error while applying staff decision");
    } finally {
      setActionLoading(false);
    }
  }

  function requestDecision(action: "approve" | "reject") {
    setPendingAction(action);
    setConfirmOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Verification History & AI Evidence</CardTitle>
        {history === null && (
          <Button size="sm" variant="outline" onClick={loadHistory} disabled={loading}>
            {loading ? "Loading..." : "Load History"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {history === null && !error && (
          <p className="text-sm text-muted-foreground">
            Load history to review system recommendation evidence before final staff action.
          </p>
        )}

        {history !== null && (
          <div className="rounded border p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">Final Staff Decision</p>
            <p className="text-xs text-muted-foreground">
              This action is final and overrides system recommendation. Drivers do not see machine verdicts.
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection (required if rejecting)"
            />
            {actionError && <p className="text-sm text-red-500">{actionError}</p>}
            {actionMessage && <p className="text-sm text-green-600">{actionMessage}</p>}
            <div className="flex gap-2">
              <Button
                onClick={() => requestDecision("approve")}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading ? "Applying..." : "Approve Driver"}
              </Button>
              <Button
                onClick={() => requestDecision("reject")}
                disabled={actionLoading}
                variant="destructive"
              >
                {actionLoading ? "Applying..." : "Reject Driver"}
              </Button>
            </div>
          </div>
        )}
        {history?.length === 0 && (
          <p className="text-sm text-muted-foreground">No verification submissions found.</p>
        )}

        {history?.map((item) => (
          <div key={item.id} className="rounded border p-4 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-muted-foreground">Document Type:</span>{" "}
                <Badge variant="outline">{item.documentType}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Submitted:</span>{" "}
                {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Verified At:</span>{" "}
                {item.verifiedAt ? new Date(item.verifiedAt).toLocaleString() : "-"}
              </div>
            </div>

            {item.documents.map((doc) => {
              const parsed = parseRecommendation(doc.mlAnalysis);
              return (
                <div key={doc.id} className="rounded border p-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Document Status:</span>{" "}
                      <Badge>{doc.verificationStatus}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Selfie Verified:</span>{" "}
                      {doc.selfieVerified ? "Yes" : "No"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">System Recommendation:</span>{" "}
                      <Badge variant="secondary">{parsed.recommendation || "N/A"}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ML Pipeline Stage:</span>{" "}
                      <Badge variant="outline">{parsed.stage || "N/A"}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Text Score:</span>{" "}
                      {parsed.textScore?.toFixed(3) ?? "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Face Similarity:</span>{" "}
                      {parsed.faceSimilarity?.toFixed(3) ?? "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liveness:</span>{" "}
                      {parsed.livenessPassed === undefined
                        ? "-"
                        : parsed.livenessPassed
                          ? "Passed"
                          : "Failed"}
                    </div>
                  </div>

                  {parsed.reasons.length > 0 && (
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">Recommendation reasons:</p>
                      <ul className="list-disc pl-5">
                        {parsed.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    {doc.selfieImage && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Selfie / Liveness Frame</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={toImageUrl(doc.selfieImage)}
                          alt="Selfie"
                          className="w-full max-h-60 object-contain rounded border"
                        />
                      </div>
                    )}
                    {doc.docImageTop && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Document Front</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={toImageUrl(doc.docImageTop)}
                          alt="Document Front"
                          className="w-full max-h-60 object-contain rounded border"
                        />
                      </div>
                    )}
                    {doc.docImageBottom && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Document Back</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={toImageUrl(doc.docImageBottom)}
                          alt="Document Back"
                          className="w-full max-h-60 object-contain rounded border"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "approve" ? "Confirm Driver Approval" : "Confirm Driver Rejection"}
            </DialogTitle>
            <DialogDescription>
              This is a final staff decision and will be recorded in action logs.
              {pendingAction === "reject"
                ? " Rejection reason will be stored and visible in history."
                : " Driver will move to VERIFIED status."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === "reject" ? "destructive" : "default"}
              onClick={async () => {
                if (!pendingAction) return;
                await handleDecision(pendingAction);
                setConfirmOpen(false);
                setPendingAction(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
