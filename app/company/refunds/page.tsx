"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildIdempotencyKey } from "@/lib/idempotency";

type RefundRequest = {
  id: string;
  amountCoins: string | number;
  amountMoney?: string | number;
  destinationType: string;
  status: string;
  reason?: string | null;
  createdAt: string;
};

function CompanyRefundsPageContent() {
  const searchParams = useSearchParams();
  const highlightRefund = searchParams.get("highlightRefund");

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [amount, setAmount] = useState("100");
  const [destinationType, setDestinationType] = useState("BANK_TRANSFER");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [walletAvailable, setWalletAvailable] = useState(0);

  const load = async (keepLoading = false) => {
    if (!keepLoading) setLoading(true);
    try {
      const [refundRes, walletRes] = await Promise.all([
        fetch("/api/company/refund-requests").then((x) => x.json()),
        fetch("/api/company/wallet").then((x) => x.json()),
      ]);
      setRefunds(Array.isArray(refundRes) ? refundRes : []);
      const available = Number(walletRes?.balance || 0) - Number(walletRes?.locked || 0);
      setWalletAvailable(available > 0 ? available : 0);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load refunds");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!highlightRefund || refunds.length === 0) return;
    const idx = refunds.findIndex((r) => r.id === highlightRefund);
    if (idx < 0) return;
    const nextPage = Math.floor(idx / pageSize) + 1;
    setPage(nextPage);
  }, [highlightRefund, refunds]);

  useEffect(() => {
    if (!highlightRefund) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`refund-req-${highlightRefund}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightRefund, page, refunds]);

  const exportCsv = () => {
    const lines = [
      "id,amountCoins,destinationType,status,reason,createdAt",
      ...refunds.map((r) =>
        [
          r.id,
          Number(r.amountCoins || 0).toFixed(2),
          r.destinationType,
          r.status,
          (r.reason || "").replace(/"/g, '""'),
          r.createdAt,
        ]
          .map((v) => `"${String(v)}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "company-refunds.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const createRefund = async () => {
    setMessage(null);
    try {
      const amountNum = Number(amount);
      if (amountNum > walletAvailable) {
        throw new Error(`Refund cannot exceed available balance (${walletAvailable.toFixed(2)} coins).`);
      }
      const res = await fetch("/api/company/refund-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": buildIdempotencyKey("company-refund-create", {
            amountCoins: amountNum,
            destinationType,
            reason: reason || undefined,
          }),
        },
        body: JSON.stringify({
          amountCoins: amountNum,
          destinationType,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit refund request");
      setMessage("Refund request submitted.");
      setReason("");
      await load(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to submit refund request");
    }
  };

  if (loading) return <div>Loading refunds...</div>;
  const totalPages = Math.max(1, Math.ceil(refunds.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRefunds = refunds.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">New Refund Request</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Available for refund after platform locks/fees: {walletAvailable.toFixed(2)} coins
        </p>
        <div className="grid gap-2">
          <input className="rounded-md border px-3 py-2" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in coins" />
          <select className="rounded-md border px-3 py-2" value={destinationType} onChange={(e) => setDestinationType(e.target.value)}>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CARD_REFUND">Card refund</option>
          </select>
          <input className="rounded-md border px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
          <button className="rounded-md border px-3 py-2" onClick={createRefund}>
            Submit Request
          </button>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Refund History</h2>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <div className="space-y-2">
          {pagedRefunds.map((r) => (
            <div key={r.id} id={`refund-req-${r.id}`} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span>{Number(r.amountCoins || 0).toFixed(2)} coins</span>
                <span>{r.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">Destination: {r.destinationType}</p>
              <p className="text-xs text-muted-foreground">Reason: {r.reason || "-"}</p>
              <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {refunds.length === 0 && <p className="text-sm text-muted-foreground">No refund requests yet.</p>}
        </div>
        {refunds.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>
              Page {currentPage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-md border px-2 py-1 disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="rounded-md border px-2 py-1 disabled:opacity-50"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function CompanyRefundsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading refunds…</div>}>
      <CompanyRefundsPageContent />
    </Suspense>
  );
}
