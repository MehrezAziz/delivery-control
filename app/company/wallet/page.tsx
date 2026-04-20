"use client";

import { useEffect, useState } from "react";
import { formatCoinsCeil3 } from "@/lib/format-coins";

type WalletInfo = {
  balance: number;
  locked: number;
  maxNegativeBalance: number;
  availableCapacity: number;
};

type WalletTx = {
  id: string;
  type: string;
  kind?: "BUDGET" | "ORDER" | string;
  orderStatus?: string | null;
  amount: string | number;
  description?: string | null;
  createdAt: string;
};

function formatWalletAmount(tx: WalletTx): { text: string; strike?: boolean } {
  const t = String(tx.type || "").toUpperCase();
  const st = String(tx.orderStatus || "").toUpperCase();
  const raw = Number(tx.amount || 0);
  const fmt = formatCoinsCeil3(raw);
  if (t.includes("MAIN_COMPANY_BUDGET_WITHDRAWAL")) {
    return { text: `-${fmt}` };
  }
  if (t.includes("BUDGET_REQUEST_REJECTED")) {
    return { text: fmt, strike: true };
  }
  if (t.includes("ORDER_ACTIVITY") && st === "CANCELLED") {
    return { text: formatCoinsCeil3(0) };
  }
  const settled = ["DELIVERED", "RETURN_DEPOSIT", "REFUNDED", "CANCELLED"];
  if (t.includes("ORDER_ACTIVITY") && st && !settled.includes(st)) {
    return { text: `~${fmt}` };
  }
  return { text: fmt };
}

function txTone(tx: WalletTx): string {
  const t = String(tx.type || "").toUpperCase();
  const st = String(tx.orderStatus || "").toUpperCase();
  if (t.includes("ORDER_ACTIVITY") || st) {
    if (st.includes("DELIVER")) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    if (st.includes("CANCEL")) return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
    if (st.includes("RETURN")) return "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200";
    if (st.includes("PENDING") || st.includes("SEARCH")) return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    return "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";
  }
  if (t.includes("MAIN_COMPANY_BUDGET_WITHDRAWAL")) {
    return "bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100";
  }
  if (t.includes("APPROVED") || t.includes("TRANSFER_IN")) {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  }
  if (t.includes("REJECT") || t.includes("DEBIT") || t.includes("PAYMENT")) {
    return "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200";
  }
  if (t.includes("REQUEST")) return "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200";
  return "bg-muted text-foreground";
}

export default function CompanyWalletPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [w, tx] = await Promise.all([
          fetch("/api/company/wallet").then((x) => x.json()),
          fetch("/api/company/wallet/transactions").then((x) => x.json()),
        ]);
        setWallet(w);
        setTransactions(Array.isArray(tx) ? tx : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load wallet");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <div>Loading wallet...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{error}</div>}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Balance</p>
          <p className="text-lg font-semibold">{formatCoinsCeil3(wallet?.balance || 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Locked</p>
          <p className="text-lg font-semibold">{formatCoinsCeil3(wallet?.locked || 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Available Capacity</p>
          <p className="text-lg font-semibold">{formatCoinsCeil3(wallet?.availableCapacity || 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Max Negative Balance</p>
          <p className="text-lg font-semibold">{formatCoinsCeil3(wallet?.maxNegativeBalance || 0)}</p>
        </div>
      </section>
      <section className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
        <h2 className="text-lg font-semibold">Buy coins</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase additional coins for your company wallet.{" "}
          <span className="font-medium text-foreground">Coming soon.</span>
        </p>
      </section>
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Transactions</h2>
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${txTone(tx)}`}
                >
                  {tx.type}
                  {tx.orderStatus ? (
                    <span className="font-normal opacity-90">· {String(tx.orderStatus).replace(/_/g, " ")}</span>
                  ) : null}
                </span>
                {(() => {
                  const f = formatWalletAmount(tx);
                  return (
                    <span
                      className={`font-mono tabular-nums ${f.strike ? "text-muted-foreground line-through" : ""}`}
                    >
                      {f.text}
                    </span>
                  );
                })()}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{tx.description || "-"}</p>
              <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
        </div>
      </section>
    </div>
  );
}
