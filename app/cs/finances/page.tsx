"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FinanceLedgerTable } from "@/components/finance-ledger-table";
import type { FinanceLedgerRow } from "@/lib/finance-ledger";

interface DriverAccount {
  id: string;
  driverId: string;
  balance: number;
  currency: string;
  completedDeliveries: number;
  driverName: string;
  phone: string | null;
  driverStatus: string;
}

export default function CSFinancesPage() {
  const [accounts, setAccounts] = useState<DriverAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FinanceLedgerRow[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState("");

  // Record transaction form state
  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState("DEPOSIT");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/drivers/finances").then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error); });
        return r.json();
      }),
      fetch("/api/auth/me").then(r => r.json()),
    ])
      .then(([data, me]) => {
        setAccounts(data);
        setCanManage(
          me.role === "ADMIN" || (me.csRoles || []).includes("MANAGE_FINANCIAL_REPORTS")
        );
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleExpand(accountId: string) {
    if (expandedId === accountId) { setExpandedId(null); return; }
    setExpandedId(accountId);
    setTransactions([]);
    setTxError("");
    setAmount(""); setDescription(""); setTxType("DEPOSIT");
    setFormError(""); setSuccess("");
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/drivers/finances/${accountId}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) {
        setTxError(data.error || `Failed to load transactions (${res.status})`);
        return;
      }
      if (data.transactions) setTransactions(data.transactions);
    } catch {
      setTxError("Network error loading transactions");
    } finally { setLoadingTx(false); }
  }

  async function handleSubmit(accountId: string) {
    setFormError(""); setSuccess("");
    const num = parseFloat(amount);
    if (!num || isNaN(num)) { setFormError("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/drivers/finances/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, type: txType, description: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Failed"); return; }
      setSuccess(`Balance updated to ${data.newBalance.toFixed(2)}`);
      setAmount(""); setDescription("");
      // Reload transactions
      const res2 = await fetch(`/api/drivers/finances/${accountId}`);
      const data2 = await res2.json();
      if (data2.transactions) setTransactions(data2.transactions);
      // Reload accounts
      const res3 = await fetch("/api/drivers/finances");
      if (res3.ok) setAccounts(await res3.json());
    } catch { setFormError("Network error"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Driver Finances</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Drivers</p>
          <p className="text-2xl font-bold">{accounts.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Debt</p>
          <p className="text-2xl font-bold text-red-600">
            {accounts.filter(d => d.balance < 0).reduce((s, d) => s + d.balance, 0).toFixed(2)} TND
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Credit</p>
          <p className="text-2xl font-bold text-green-600">
            {accounts.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0).toFixed(2)} TND
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deliveries</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map(acc => (
              <>
                <TableRow key={acc.id} className={acc.balance < 0 ? "bg-red-50/50" : ""}>
                  <TableCell className="font-medium">{acc.driverName}</TableCell>
                  <TableCell>{acc.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={acc.driverStatus === "VERIFIED" ? "default" : "secondary"}>
                      {acc.driverStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{acc.completedDeliveries}</TableCell>
                  <TableCell className={`text-right font-bold ${acc.balance < 0 ? "text-red-600" : acc.balance > 0 ? "text-green-600" : ""}`}>
                    {acc.balance.toFixed(2)} {acc.currency}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toggleExpand(acc.id)}>
                      {expandedId === acc.id ? "Close" : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedId === acc.id && (
                  <TableRow key={`${acc.id}-detail`}>
                    <TableCell colSpan={6}>
                      <div className="bg-muted rounded-lg p-4 space-y-4 border">
                        {/* Record transaction form — only for MANAGE_FINANCIAL_REPORTS */}
                        {canManage && (
                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-foreground">Record Transaction</p>
                            <div className="flex flex-wrap gap-3 items-end">
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Type</label>
                                <select value={txType} onChange={e => setTxType(e.target.value)}
                                  className="h-9 rounded-md border px-3 text-sm bg-card">
                                  <option value="DEPOSIT">Deposit</option>
                                  <option value="ADJUSTMENT">Adjustment</option>
                                  <option value="BONUS">Bonus</option>
                                  <option value="PENALTY">Penalty</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Amount</label>
                                <Input type="number" step="0.01" placeholder="e.g. 50.00"
                                  value={amount} onChange={e => setAmount(e.target.value)} className="w-36" />
                              </div>
                              <div className="space-y-1 flex-1 min-w-[200px]">
                                <label className="text-xs text-muted-foreground">Description</label>
                                <Input placeholder="Optional note" value={description}
                                  onChange={e => setDescription(e.target.value)} />
                              </div>
                              <Button size="sm" onClick={() => handleSubmit(acc.id)} disabled={saving}>
                                {saving ? "Saving..." : "Submit"}
                              </Button>
                            </div>
                            {formError && <p className="text-sm text-red-500">{formError}</p>}
                            {success && <p className="text-sm text-green-600">{success}</p>}
                          </div>
                        )}
                        {/* Transaction history */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">All transactions</p>
                          {txError ? <p className="text-sm text-red-500">{txError}</p> : null}
                          <FinanceLedgerTable
                            rows={transactions}
                            loading={loadingTx}
                            showStatus
                            showOrder={false}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
