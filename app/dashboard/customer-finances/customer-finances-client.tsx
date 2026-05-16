"use client";

import { Fragment, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FinanceLedgerTable } from "@/components/finance-ledger-table";
import type { FinanceLedgerRow } from "@/lib/finance-ledger";

export interface CustomerWalletRow {
  id: string;
  customerId: string;
  balance: number;
  lockedForTransfers: number;
  currency: string;
  discount: number;
  customerName: string;
  phone: string | null;
  customerStatus: string;
  referralCode: string | null;
  countryName: string;
  updatedAt: string;
}

type BalanceFilter = "all" | "zero" | "positive";

export default function CustomerFinancesClient({ accounts }: { accounts: CustomerWalletRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FinanceLedgerRow[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState("");
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");

  const filtered = useMemo(() => {
    let result = accounts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.customerName.toLowerCase().includes(q) ||
          (a.phone || "").includes(q) ||
          (a.referralCode || "").toLowerCase().includes(q),
      );
    }
    if (balanceFilter === "zero") result = result.filter((a) => a.balance === 0);
    else if (balanceFilter === "positive") result = result.filter((a) => a.balance > 0);
    return result;
  }, [accounts, search, balanceFilter]);

  async function toggleExpand(walletId: string) {
    if (expandedId === walletId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(walletId);
    setTransactions([]);
    setTxError("");
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/customers/finances/${walletId}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) {
        setTxError(data.error || `Failed to load transactions (${res.status})`);
        return;
      }
      if (data.transactions) setTransactions(data.transactions);
    } catch {
      setTxError("Network error loading transactions");
    } finally {
      setLoadingTx(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Search</label>
          <Input
            placeholder="Name, phone, referral code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Balance</label>
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as BalanceFilter)}
            className="h-9 rounded-md border px-3 text-sm bg-card"
          >
            <option value="all">All</option>
            <option value="positive">Has balance</option>
            <option value="zero">Zero</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground self-end pb-1">
          {filtered.length} of {accounts.length} customers
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Balance (coins)</TableHead>
              <TableHead className="text-right">Locked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No customers match filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((acc) => (
                <Fragment key={acc.id}>
                  <TableRow>
                    <TableCell className="font-medium">{acc.customerName}</TableCell>
                    <TableCell>{acc.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{acc.customerStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{acc.countryName}</TableCell>
                    <TableCell
                      className={`text-right font-bold ${acc.balance > 0 ? "text-green-600" : ""}`}
                    >
                      {acc.balance.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {acc.lockedForTransfers > 0 ? acc.lockedForTransfers.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => toggleExpand(acc.id)}>
                        {expandedId === acc.id ? "Close" : "Manage"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === acc.id && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="bg-muted rounded-lg p-4 space-y-3 border">
                          {acc.referralCode && (
                            <p className="text-sm text-muted-foreground">
                              Referral code:{" "}
                              <span className="font-mono font-semibold text-foreground">
                                {acc.referralCode}
                              </span>
                            </p>
                          )}
                          <p className="text-sm font-semibold text-foreground">All transactions</p>
                          {txError ? <p className="text-sm text-red-500">{txError}</p> : null}
                          <FinanceLedgerTable
                            rows={transactions}
                            loading={loadingTx}
                            showStatus
                            showOrder
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
