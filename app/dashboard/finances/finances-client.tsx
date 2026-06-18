"use client";

import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceLedgerTable } from "@/components/finance-ledger-table";
import type { FinanceLedgerRow } from "@/lib/finance-ledger";
import {
  Wallet,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
  Phone,
  Package,
  ChevronDown,
  ChevronUp,
  Filter,
  Ban,
} from "lucide-react";

interface DriverAccount {
  id: string;
  driverId: string;
  balance: number;
  currency: string;
  completedDeliveries: number;
  driverName: string;
  phone: string | null;
  driverStatus: string;
  createdAt: string;
}

type BalanceFilter = "all" | "negative" | "positive" | "zero";
type DateFilter = "all" | "today" | "week" | "month" | "year";

function getDateRange(filter: DateFilter): Date | null {
  if (filter === "all") return null;
  const now = new Date();
  if (filter === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filter === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (filter === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const BALANCE_FILTERS: { value: BalanceFilter; label: string }[] = [
  { value: "all", label: "All balances" },
  { value: "negative", label: "In debt" },
  { value: "positive", label: "Credit" },
  { value: "zero", label: "Zero" },
];

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

export default function FinancesClient({
  accounts,
  stats,
}: {
  accounts: DriverAccount[];
  stats: {
    totalDrivers: number;
    inDebt: number;
    totalDebt: number;
    totalCredit: number;
  };
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FinanceLedgerRow[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState("");
  const [negativeBalanceInfo, setNegativeBalanceInfo] = useState<{
    negativeBalanceSince: string;
    daysRemainingToPay: number;
    maxNegativeDays: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState("DEPOSIT");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filtered = useMemo(() => {
    let result = accounts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) => a.driverName.toLowerCase().includes(q) || (a.phone || "").includes(q),
      );
    }
    if (balanceFilter === "negative") result = result.filter((a) => a.balance < 0);
    else if (balanceFilter === "positive") result = result.filter((a) => a.balance > 0);
    else if (balanceFilter === "zero") result = result.filter((a) => a.balance === 0);
    const dateStart = getDateRange(dateFilter);
    if (dateStart) result = result.filter((a) => new Date(a.createdAt) >= dateStart);
    return result;
  }, [accounts, search, balanceFilter, dateFilter]);

  async function toggleExpand(accountId: string) {
    if (expandedId === accountId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(accountId);
    setTransactions([]);
    setNegativeBalanceInfo(null);
    setTxError("");
    setAmount("");
    setDescription("");
    setTxType("DEPOSIT");
    setError("");
    setSuccess("");
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/drivers/finances/${accountId}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) {
        setTxError(data.error || `Failed to load transactions (${res.status})`);
        return;
      }
      if (data.transactions) setTransactions(data.transactions);
      if (data.negativeBalanceInfo) setNegativeBalanceInfo(data.negativeBalanceInfo);
    } catch {
      setTxError("Network error loading transactions");
    } finally {
      setLoadingTx(false);
    }
  }

  async function handleSubmit(accountId: string) {
    setError("");
    setSuccess("");
    const num = parseFloat(amount);
    if (!num || Number.isNaN(num)) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/drivers/finances/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, type: txType, description: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      setSuccess(`Balance updated to ${data.newBalance.toFixed(2)}`);
      setAmount("");
      setDescription("");
      const res2 = await fetch(`/api/drivers/finances/${accountId}`);
      const data2 = await res2.json();
      if (data2.transactions) setTransactions(data2.transactions);
      setTimeout(() => router.refresh(), 500);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-emerald-50/50 via-background to-background dark:from-emerald-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative p-6 sm:p-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Wallet className="h-3.5 w-3.5" />
              Driver wallets
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Wallet className="h-8 w-8 opacity-90" />
              Driver Finances
            </h1>
            <p className="text-emerald-100 text-sm max-w-2xl">
              Monitor driver account balances, record deposits and adjustments, and review transaction
              history for drivers in debt.
            </p>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/15">
            <HeroStat icon={<Users className="h-3.5 w-3.5" />} label="Drivers" value={stats.totalDrivers} />
            <HeroStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="In debt" value={stats.inDebt} />
            <HeroStat
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              label="Total debt"
              value={`${stats.totalDebt.toFixed(0)}`}
              suffix=" TND"
            />
            <HeroStat
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Total credit"
              value={`${stats.totalCredit.toFixed(0)}`}
              suffix=" TND"
            />
          </div>
        </div>

        {/* Filters */}
        <Card className="overflow-hidden border-emerald-200/50 dark:border-emerald-800/30">
          <div className="h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <CardContent className="pt-5 pb-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search driver name or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground lg:ml-auto tabular-nums">
                {filtered.length} of {accounts.length} drivers
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  Balance
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BALANCE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setBalanceFilter(f.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        balanceFilter === f.value
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account age</p>
                <div className="flex flex-wrap gap-1.5">
                  {DATE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setDateFilter(f.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        dateFilter === f.value
                          ? "bg-teal-600 text-white shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts table */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base">Driver accounts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Wallet className="h-7 w-7 text-emerald-600" />
                </div>
                <p className="font-medium">No drivers match filters</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setBalanceFilter("all");
                    setDateFilter("all");
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
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deliveries</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((acc) => {
                      const isExpanded = expandedId === acc.id;
                      const isDebt = acc.balance < 0;
                      return (
                        <Fragment key={acc.id}>
                          <TableRow
                            className={`group transition-colors ${
                              isDebt
                                ? "bg-red-50/40 dark:bg-red-950/15 hover:bg-red-50/70"
                                : "hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                            }`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-xs font-semibold ${
                                    isDebt
                                      ? "bg-gradient-to-br from-red-500 to-rose-600"
                                      : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                  }`}
                                >
                                  {initials(acc.driverName)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{acc.driverName}</p>
                                  {acc.phone && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {acc.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={acc.driverStatus === "VERIFIED" ? "default" : "secondary"}
                                className={
                                  acc.driverStatus === "VERIFIED"
                                    ? "bg-emerald-600 hover:bg-emerald-600"
                                    : ""
                                }
                              >
                                {acc.driverStatus.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm tabular-nums">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                {acc.completedDeliveries}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-bold tabular-nums text-base ${
                                  isDebt
                                    ? "text-red-600 dark:text-red-400"
                                    : acc.balance > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : ""
                                }`}
                              >
                                {acc.balance.toFixed(2)}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">{acc.currency}</span>
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
                                    Manage <ChevronDown className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-muted/20 p-0">
                                <div className="p-4 sm:p-6 space-y-5 border-t">
                                  {negativeBalanceInfo && (
                                    <div
                                      className={`rounded-xl p-4 flex gap-3 ${
                                        negativeBalanceInfo.daysRemainingToPay <= 0
                                          ? "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900"
                                          : "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
                                      }`}
                                    >
                                      {negativeBalanceInfo.daysRemainingToPay <= 0 ? (
                                        <Ban className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                      ) : (
                                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                      )}
                                      <div>
                                        {negativeBalanceInfo.daysRemainingToPay <= 0 ? (
                                          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                            Account paused — exceeded {negativeBalanceInfo.maxNegativeDays}{" "}
                                            days with negative balance
                                          </p>
                                        ) : (
                                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                            {negativeBalanceInfo.daysRemainingToPay} day
                                            {negativeBalanceInfo.daysRemainingToPay !== 1 ? "s" : ""} remaining
                                            to pay fees (max {negativeBalanceInfo.maxNegativeDays} days)
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Negative since:{" "}
                                          {new Date(
                                            negativeBalanceInfo.negativeBalanceSince,
                                          ).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  <div className="rounded-xl border bg-card p-4 space-y-3">
                                    <p className="text-sm font-semibold">Record transaction</p>
                                    <div className="flex flex-wrap gap-3 items-end">
                                      <div className="space-y-1.5">
                                        <label className="text-xs text-muted-foreground">Type</label>
                                        <select
                                          value={txType}
                                          onChange={(e) => setTxType(e.target.value)}
                                          className="h-9 rounded-lg border px-3 text-sm bg-background min-w-[180px]"
                                        >
                                          <option value="DEPOSIT">Deposit (driver pays debt)</option>
                                          <option value="ADJUSTMENT">Adjustment</option>
                                          <option value="BONUS">Bonus</option>
                                          <option value="PENALTY">Penalty</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-xs text-muted-foreground">Amount</label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="e.g. 50.00"
                                          value={amount}
                                          onChange={(e) => setAmount(e.target.value)}
                                          className="w-36"
                                        />
                                      </div>
                                      <div className="space-y-1.5 flex-1 min-w-[200px]">
                                        <label className="text-xs text-muted-foreground">Description</label>
                                        <Input
                                          placeholder="Optional note"
                                          value={description}
                                          onChange={(e) => setDescription(e.target.value)}
                                        />
                                      </div>
                                      <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => void handleSubmit(acc.id)}
                                        disabled={saving}
                                      >
                                        {saving ? "Saving…" : "Submit"}
                                      </Button>
                                    </div>
                                    {error && (
                                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                    )}
                                    {success && (
                                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                        {success}
                                      </p>
                                    )}
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
                                      showOrder={false}
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
  suffix = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="px-3 py-3 text-center sm:px-4">
      <div className="flex items-center justify-center gap-1.5 text-emerald-200 text-[10px] uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-lg sm:text-xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix}
      </p>
    </div>
  );
}
