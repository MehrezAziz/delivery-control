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
  translationLocale: string | null;
  translationData: Record<string, unknown> | null;
};

type IdentityFieldBundle = Partial<
  Record<"firstName" | "lastName" | "idNumber" | "dateOfBirth", string>
>;

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
  ocrDeclaredMismatch?: boolean;
  informationMatchScore?: number;
  textClarityScore?: number;
  textScoreFormula?: string | null;
  usedTranslation?: boolean;
  translationTargetLocale?: string | null;
  translationError?: string | null;
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
  const ocrDeclaredMismatch =
    typeof ml.ocrDeclaredMismatch === "boolean" ? ml.ocrDeclaredMismatch : undefined;
  const stage = typeof ml.stage === "string" ? ml.stage : undefined;

  const scoring = ml.scoring && typeof ml.scoring === "object" ? (ml.scoring as Record<string, unknown>) : null;
  const informationMatchScore =
    typeof scoring?.informationMatchScore === "number" ? scoring.informationMatchScore : undefined;
  const textClarityScore = typeof scoring?.textClarityScore === "number" ? scoring.textClarityScore : undefined;
  const textScoreFormula = typeof scoring?.textScoreFormula === "string" ? scoring.textScoreFormula : null;
  const usedTranslation = scoring?.usedTranslation === true ? true : undefined;
  const translationTargetLocale =
    typeof scoring?.translationTargetLocale === "string" ? scoring.translationTargetLocale : null;
  const translationError =
    typeof scoring?.translationError === "string" ? scoring.translationError : null;

  return {
    recommendation,
    stage,
    reasons,
    textScore,
    faceSimilarity,
    livenessPassed,
    ocrDeclaredMismatch,
    informationMatchScore,
    textClarityScore,
    textScoreFormula,
    usedTranslation,
    translationTargetLocale,
    translationError,
  };
}

function formatDob(v: string | Date | null | undefined): string {
  if (v == null) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return String(v);
}

function IdentityFieldRows({
  title,
  original,
  translated,
  localeLabel,
}: {
  title: string;
  original: IdentityFieldBundle;
  translated: IdentityFieldBundle;
  localeLabel: string;
}) {
  const keys: (keyof IdentityFieldBundle)[] = ["firstName", "lastName", "idNumber", "dateOfBirth"];
  const labels: Record<keyof IdentityFieldBundle, string> = {
    firstName: "First name",
    lastName: "Last name",
    idNumber: "ID number",
    dateOfBirth: "Date of birth",
  };
  const rows = keys.filter((k) => original[k] || translated[k]);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {rows.map((k) => (
        <div key={k} className="text-sm grid gap-1 sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{labels[k]}: </span>
            <span className="font-medium">{original[k] ?? "—"}</span>
            <span className="block text-xs text-muted-foreground">(as captured / declared)</span>
          </div>
          <div>
            <span className="text-muted-foreground">{labels[k]} ({localeLabel}): </span>
            <span className="font-medium text-primary">{translated[k] ?? "—"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TranslationEvidencePanel({
  translationLocale,
  translationData,
  doc,
}: {
  translationLocale: string | null;
  translationData: Record<string, unknown> | null;
  doc: VerificationDoc;
}) {
  if (!translationData || typeof translationData !== "object") {
    const hasAny =
      Boolean(doc.firstName) || Boolean(doc.lastName) || Boolean(doc.idNumber) || Boolean(doc.dateOfBirth);
    return (
      <div className="space-y-3 border-t pt-3 mt-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Translated identity (staff review)</p>
          <Badge variant="secondary">Not available yet</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          No stored translation for this submission. This can happen for older verifications (before translation was
          enabled) or if translation failed.
        </p>
        {hasAny ? (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Original identity fields (document record)
            </p>
            <p className="text-sm">
              {[doc.firstName, doc.lastName].filter(Boolean).join(" ") || "—"}
              {doc.idNumber ? ` · ID ${doc.idNumber}` : ""}
              {doc.dateOfBirth ? ` · DOB ${formatDob(doc.dateOfBirth)}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  const err = typeof translationData.error === "string" ? translationData.error : undefined;
  const target =
    (typeof translationData.targetLocale === "string" ? translationData.targetLocale : null) ||
    translationLocale ||
    "en";
  const provider = typeof translationData.provider === "string" ? translationData.provider : "google";
  const at =
    typeof translationData.translatedAt === "string"
      ? new Date(translationData.translatedAt).toLocaleString()
      : null;

  const od = translationData.originalDeclared as IdentityFieldBundle | undefined;
  const oe = translationData.originalExtracted as IdentityFieldBundle | undefined;
  const td = translationData.translatedDeclared as IdentityFieldBundle | undefined;
  const te = translationData.translatedExtracted as IdentityFieldBundle | undefined;

  return (
    <div className="space-y-3 border-t pt-3 mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Translated identity (staff review)</p>
        <Badge variant="outline">{provider}</Badge>
        <Badge variant="secondary">→ {target}</Badge>
        {at ? <span className="text-xs text-muted-foreground">{at}</span> : null}
      </div>
      {err ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Translation failed: {err}. Text score used original strings only.
        </p>
      ) : null}
      {od && td ? (
        <IdentityFieldRows
          title="Declared (User + document fields)"
          original={od}
          translated={td}
          localeLabel={target}
        />
      ) : null}
      {oe && te ? (
        <IdentityFieldRows
          title="Extracted from document (OCR)"
          original={oe}
          translated={te}
          localeLabel={target}
        />
      ) : null}
    </div>
  );
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
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Text Score:</span>{" "}
                      {parsed.textScore?.toFixed(3) ?? "-"}
                      {typeof parsed.informationMatchScore === "number" &&
                      typeof parsed.textClarityScore === "number" &&
                      typeof parsed.textScore === "number" ? (
                        <div className="mt-1 text-xs text-muted-foreground space-y-1">
                          <p>Information matches (50%): {parsed.informationMatchScore.toFixed(2)}</p>
                          <p>Text clarity (50%): {parsed.textClarityScore.toFixed(2)}</p>
                          <p>
                            text score = {parsed.informationMatchScore.toFixed(2)} +{" "}
                            {parsed.textClarityScore.toFixed(2)} = {parsed.textScore.toFixed(2)}
                          </p>
                        </div>
                      ) : parsed.textScoreFormula ? (
                        <span className="block text-xs text-muted-foreground mt-1">
                          text score = {parsed.textScoreFormula}
                        </span>
                      ) : null}
                      {parsed.usedTranslation ? (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Compared after translation → {parsed.translationTargetLocale ?? "en"}
                        </Badge>
                      ) : null}
                      {parsed.translationError ? (
                        <span className="block text-xs text-amber-700 dark:text-amber-400 mt-1">
                          Translation note: {parsed.translationError}
                        </span>
                      ) : null}
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
                    <div>
                      <span className="text-muted-foreground">OCR vs Declared:</span>{" "}
                      {parsed.ocrDeclaredMismatch === undefined ? (
                        "-"
                      ) : parsed.ocrDeclaredMismatch ? (
                        <Badge variant="destructive">Mismatch</Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-700">Match</Badge>
                      )}
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

                  <TranslationEvidencePanel
                    translationLocale={doc.translationLocale ?? null}
                    translationData={doc.translationData}
                    doc={doc}
                  />

                  <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground border-t pt-2">
                    <p>
                      <span className="font-medium text-foreground">Document record: </span>
                      {doc.firstName || doc.lastName || doc.idNumber || doc.dateOfBirth ? (
                        <>
                          {[doc.firstName, doc.lastName].filter(Boolean).join(" ") || "—"}
                          {doc.idNumber ? ` · ID ${doc.idNumber}` : ""}
                          {doc.dateOfBirth ? ` · DOB ${formatDob(doc.dateOfBirth)}` : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>

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
