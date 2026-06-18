"use client";

import { Fragment, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceLedgerTable } from "@/components/finance-ledger-table";
import { CustomerStatusIndicator } from "@/components/customer-status-indicator";
import type { FinanceLedgerRow } from "@/lib/finance-ledger";
import {
  Coins,
  Search,
  Filter,
  Users,
  Wallet,
  Lock,
  Globe,
  Phone,
  Gift,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

const BALANCE_FILTERS: { value: BalanceFilter; label: string }[] = [
  { value: "all", label: "All wallets" },
  { value: "positive", label: "Has balance" },
  { value: "zero", label: "Zero balance" },
];

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function CustomerFinancesClient({
  accounts,
  stats,
}: {
  accounts: CustomerWalletRow[];
  stats: {
    walletCount: number;
    withBalance: number;
    totalBalance: number;
    totalLocked: number;
  };
}) {
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
          (a.referralCode || "").toLowerCase().includes(q) ||
          a.countryName.toLowerCase().includes(q),
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
    <div className="min-h-full bg-gradient-to-b from-amber-50/50 via-background to-background dark:from-amber-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500 via-yellow-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Coins className="h-3.5 w-3.5" />
              Customer coin wallets
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Wallet className="h-8 w-8 opacity-90" />
              Customer Finances
            </h1>
            <p className="text-amber-100 text-sm max-w-2xl">
              View digital wallet balances per country, locked transfer amounts, referral codes, and
              full transaction history for each customer.
            </p>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/15">
            <HeroStat icon={<Users className="h-3.5 w-3.5" />} label="Wallets" value={stats.walletCount} />
            <HeroStat icon={<Coins className="h-3.5 w-3.5" />} label="With balance" value={stats.withBalance} />
            <HeroStat
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Total coins"
              value={stats.totalBalance.toFixed(0)}
            />
            <HeroStat
              icon={<Lock className="h-3.5 w-3.5" />}
              label="Locked"
              value={stats.totalLocked.toFixed(0)}
            />
          </div>
        </div>

        {/* Filters */}
        <Card className="overflow-hidden border-amber-200/50 dark:border-amber-800/30">
          <div className="h-0.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500" />
          <CardContent className="pt-5 pb-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, phone, referral code, country…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground lg:ml-auto tabular-nums">
                {filtered.length} of {accounts.length} wallets
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {BALANCE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setBalanceFilter(f.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    balanceFilter === f.value
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Wallets table */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base">Customer wallets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Coins className="h-7 w-7 text-amber-600" />
                </div>
                <p className="font-medium">No wallets match filters</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setBalanceFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Locked</TableHead>
                      <TableHead className="text-right w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((acc) => {
                      const isExpanded = expandedId === acc.id;
                      const hasBalance = acc.balance > 0;
                      return (
                        <Fragment key={acc.id}>
                          <TableRow
                            className={`group transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-950/10 ${
                              hasBalance ? "" : "opacity-90"
                            }`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 text-white text-xs font-semibold">
                                  {initials(acc.customerName)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{acc.customerName}</p>
                                  {acc.phone && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Phone className="h-3 w-3" />
                                      {acc.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <CustomerStatusIndicator status={acc.customerStatus} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Globe className="h-3.5 w-3.5 shrink-0" />
                                {acc.countryName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-bold tabular-nums text-base ${
                                  hasBalance ? "text-amber-700 dark:text-amber-400" : ""
                                }`}
                              >
                                {acc.balance.toFixed(2)}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">coins</span>
                            </TableCell>
                            <TableCell className="text-right">
                              {acc.lockedForTransfers > 0 ? (
                                <span className="text-sm tabular-nums text-orange-600 dark:text-orange-400 font-medium">
                                  {acc.lockedForTransfers.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void toggleExpand(acc.id)}
                                className="gap-1"
                              >
                                {isExpanded ? (
                                  <>
                                    Close <ChevronUp className="h-3.5 w-3.5" />
                                  </>
                                ) : (
                                  <>
                                    History <ChevronDown className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/20 p-0">
                                <div className="p-4 sm:p-6 space-y-4 border-t">
                                  <div className="flex flex-wrap gap-4 text-sm">
                                    {acc.referralCode && (
                                      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                                        <Gift className="h-4 w-4 text-amber-600" />
                                        <span className="text-muted-foreground">Referral:</span>
                                        <span className="font-mono font-semibold">{acc.referralCode}</span>
                                      </div>
                                    )}
                                    {acc.discount > 0 && (
                                      <div className="rounded-lg border bg-card px-3 py-2 text-muted-foreground">
                                        Discount: <span className="font-medium text-foreground">{acc.discount}%</span>
                                      </div>
                                    )}
                                    <div className="rounded-lg border bg-card px-3 py-2 text-muted-foreground text-xs">
                                      Last updated: {new Date(acc.updatedAt).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-sm font-semibold">Transaction history</p>
                                    {txError ? (
                                      <p className="text-sm text-red-600">{txError}</p>
                                    ) : null}
                                    <FinanceLedgerTable
                                      rows={transactions}
                                      loading={loadingTx}
                                      showStatus
                                      showOrder
                                    />
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="px-3 py-3 text-center sm:px-4">
      <div className="flex items-center justify-center gap-1.5 text-amber-200 text-[10px] uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-lg sm:text-xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
