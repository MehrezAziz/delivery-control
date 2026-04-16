"use client";

import { useEffect, useState } from "react";

type WalletInfo = {
  balance: number;
  locked: number;
  maxNegativeBalance: number;
  availableCapacity: number;
};

type WalletTx = { id: string; type: string; amount: string | number; description?: string | null; createdAt: string };

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
          <p className="text-lg font-semibold">{Number(wallet?.balance || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Locked</p>
          <p className="text-lg font-semibold">{Number(wallet?.locked || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Available Capacity</p>
          <p className="text-lg font-semibold">{Number(wallet?.availableCapacity || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Max Negative Balance</p>
          <p className="text-lg font-semibold">{Number(wallet?.maxNegativeBalance || 0).toFixed(2)}</p>
        </div>
      </section>
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Transactions</h2>
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span>{tx.type}</span>
                <span>{Number(tx.amount || 0).toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{tx.description || "-"}</p>
              <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
        </div>
      </section>
    </div>
  );
}
