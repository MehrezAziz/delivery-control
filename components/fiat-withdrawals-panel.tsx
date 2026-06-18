"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  History,
  RefreshCw,
  Search,
  Truck,
  User,
  Wallet,
  AlertTriangle,
  XCircle,
} from "lucide-react";

type PayoutAmountFields = {
  currencyCode: string;
  currencySymbol: string;
  netPayoutCoins: number;
  netPayoutFiat: number | null;
  grossDebitFiat: number | null;
};

type CustomerRow = {
  id: string;
  kind: "customer_wallet";
  amount: number;
  feeAmount: number;
  payoutMethod: string;
  payoutBankHolderName?: string | null;
  payoutBankName?: string | null;
  payoutBankAccountRef?: string | null;
  description: string | null;
  requestedAt: string;
  walletBalance: number;
  walletCurrency: string;
  customer: { id: string; name: string; phone: string | null; userId: string } | null;
} & PayoutAmountFields;

type DriverRow = {
  id: string;
  kind: "driver_account";
  amount: number;
  feeAmount: number;
  payoutMethod: string;
  payoutBankHolderName?: string | null;
  payoutBankName?: string | null;
  payoutBankAccountRef?: string | null;
  description: string | null;
  requestedAt: string;
  accountBalance: number;
  accountCurrency: string;
  driver: { id: string; name: string; phone: string | null; userId: string } | null;
} & PayoutAmountFields;

type CustomerHist = Omit<CustomerRow, "walletBalance"> & {
  processedAt: string | null;
  walletCurrency: string;
};

type DriverHist = Omit<DriverRow, "accountBalance"> & {
  processedAt: string | null;
  accountCurrency: string;
};

type HistMerged = (CustomerHist & { role: "customer" }) | (DriverHist & { role: "driver" });

type RoleFilter = "all" | "customer" | "driver";
type MethodFilter = "all" | "BANK_TRANSFER" | "CASH";

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "customer", label: "Customers" },
  { value: "driver", label: "Drivers" },
];

const METHOD_FILTERS: { value: MethodFilter; label: string }[] = [
  { value: "all", label: "All methods" },
  { value: "BANK_TRANSFER", label: "Bank" },
  { value: "CASH", label: "Cash" },
];

function formatFiatAmount(value: number, currencyCode: string) {
  return `${value.toFixed(2)} ${currencyCode}`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function methodBadgeClass(method: string) {
  if (method === "BANK_TRANSFER") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (method === "CASH") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  return "bg-muted text-muted-foreground";
}

function formatMethod(method: string) {
  return method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function PayoutAmountCell({
  grossCoins,
  feeCoins,
  netPayoutCoins,
  netPayoutFiat,
  grossDebitFiat,
  currencyCode,
}: {
  grossCoins: number;
  feeCoins: number;
  netPayoutCoins: number;
  netPayoutFiat: number | null;
  grossDebitFiat: number | null;
  currencyCode: string;
}) {
  return (
    <div>
      <span className="text-lg font-semibold tabular-nums tracking-tight">
        {netPayoutFiat != null
          ? formatFiatAmount(netPayoutFiat, currencyCode)
          : `${netPayoutCoins.toFixed(2)} Coins`}
      </span>
      {netPayoutFiat != null ? (
        <span className="block text-xs text-muted-foreground tabular-nums">
          {netPayoutCoins.toFixed(2)} coins
        </span>
      ) : null}
      {feeCoins > 0 ? (
        <span className="block text-xs text-muted-foreground">
          Fee {feeCoins.toFixed(2)} coins
          {grossDebitFiat != null ? ` · wallet debit ${formatFiatAmount(grossDebitFiat, currencyCode)}` : ` · ${grossCoins.toFixed(2)} coins debited`}
        </span>
      ) : grossDebitFiat != null ? (
        <span className="block text-xs text-muted-foreground">
          Wallet debit {formatFiatAmount(grossDebitFiat, currencyCode)}
        </span>
      ) : (
        <span className="block text-xs text-muted-foreground">Wallet debit {grossCoins.toFixed(2)} coins</span>
      )}
    </div>
  );
}

function BankPayoutCell({
  payoutMethod,
  holder,
  bankName,
  accountRef,
}: {
  payoutMethod: string;
  holder?: string | null;
  bankName?: string | null;
  accountRef?: string | null;
}) {
  if (payoutMethod !== "BANK_TRANSFER") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (!holder && !bankName && !accountRef) {
    return <span className="text-xs text-amber-700 dark:text-amber-400">No bank details on file</span>;
  }
  return (
    <div className="max-w-[240px] text-xs leading-snug">
      {holder ? <div>{holder}</div> : null}
      {bankName ? <div className="text-muted-foreground">{bankName}</div> : null}
      {accountRef ? <div className="font-mono break-all text-muted-foreground">{accountRef}</div> : null}
    </div>
  );
}

export function FiatWithdrawalsPanel() {
  const [customer, setCustomer] = useState<CustomerRow[]>([]);
  const [driver, setDriver] = useState<DriverRow[]>([]);
  const [histCustomer, setHistCustomer] = useState<CustomerHist[]>([]);
  const [histDriver, setHistDriver] = useState<DriverHist[]>([]);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<"preview" | "confirm">("preview");
  const [pending, setPending] = useState<
    | ({
        type: "customer";
        id: string;
        amount: number;
        feeAmount: number;
        payoutMethod: string;
        label: string;
        walletBalance: number;
      } & PayoutAmountFields)
    | ({
        type: "driver";
        id: string;
        amount: number;
        feeAmount: number;
        payoutMethod: string;
        label: string;
        accountBalance: number;
      } & PayoutAmountFields)
    | null
  >(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ type: "customer" | "driver"; id: string; label: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/staff/fiat-withdrawals");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setCustomer(j.customer || []);
      setDriver(j.driver || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/staff/fiat-withdrawals/history");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setHistCustomer(j.customer || []);
      setHistDriver(j.driver || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const mergedHistory = useMemo(() => {
    const rows: HistMerged[] = [
      ...histCustomer.map((r) => ({ ...r, role: "customer" as const })),
      ...histDriver.map((r) => ({ ...r, role: "driver" as const })),
    ];
    rows.sort((a, b) => {
      const ta = a.processedAt ? new Date(a.processedAt).getTime() : 0;
      const tb = b.processedAt ? new Date(b.processedAt).getTime() : 0;
      return tb - ta;
    });
    return rows;
  }, [histCustomer, histDriver]);

  const stats = useMemo(() => {
    const allPending = [...customer, ...driver];
    const totalNetCoins = allPending.reduce((s, r) => s + r.netPayoutCoins, 0);
    const insufficient =
      customer.filter((r) => r.amount > r.walletBalance).length +
      driver.filter((r) => r.amount > r.accountBalance).length;
    return {
      pendingCustomer: customer.length,
      pendingDriver: driver.length,
      pendingTotal: allPending.length,
      totalNetCoins,
      insufficient,
      historyCount: mergedHistory.length,
    };
  }, [customer, driver, mergedHistory]);

  const matchesFilters = useCallback(
    (name: string, method: string) => {
      if (search.trim() && !name.toLowerCase().includes(search.toLowerCase())) return false;
      if (methodFilter !== "all" && method !== methodFilter) return false;
      return true;
    },
    [search, methodFilter],
  );

  const filteredCustomer = useMemo(
    () => customer.filter((r) => matchesFilters(r.customer?.name || "", r.payoutMethod)),
    [customer, matchesFilters],
  );

  const filteredDriver = useMemo(
    () => driver.filter((r) => matchesFilters(r.driver?.name || "", r.payoutMethod)),
    [driver, matchesFilters],
  );

  const filteredHistory = useMemo(() => {
    let rows = mergedHistory;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const name = r.role === "customer" ? r.customer?.name || "" : r.driver?.name || "";
        return name.toLowerCase().includes(q);
      });
    }
    if (roleFilter !== "all") rows = rows.filter((r) => r.role === roleFilter);
    if (methodFilter !== "all") rows = rows.filter((r) => r.payoutMethod === methodFilter);
    return rows;
  }, [mergedHistory, search, roleFilter, methodFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadQueue();
    if (historyFetched) await loadHistory();
    setRefreshing(false);
  }

  const openMarkSent = (
    row:
      | (CustomerRow & { label: string })
      | (DriverRow & { label: string }),
    type: "customer" | "driver",
    balance: number,
  ) => {
    const base = {
      id: row.id,
      amount: row.amount,
      feeAmount: row.feeAmount ?? 0,
      payoutMethod: row.payoutMethod,
      label: row.label,
      currencyCode: row.currencyCode,
      currencySymbol: row.currencySymbol,
      netPayoutCoins: row.netPayoutCoins,
      netPayoutFiat: row.netPayoutFiat,
      grossDebitFiat: row.grossDebitFiat,
    };
    setPending(
      type === "customer"
        ? { type: "customer", ...base, walletBalance: balance }
        : { type: "driver", ...base, accountBalance: balance },
    );
    setAdminNote("");
    setDialogStep("preview");
    setDialogOpen(true);
  };

  const openReject = (type: "customer" | "driver", id: string, label: string) => {
    setRejectTarget({ type, id, label });
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    const path =
      rejectTarget.type === "customer"
        ? `/api/staff/fiat-withdrawals/customer/${rejectTarget.id}/reject`
        : `/api/staff/fiat-withdrawals/driver/${rejectTarget.id}/reject`;
    setSubmitting(true);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed");
      setRejectOpen(false);
      setRejectTarget(null);
      await loadQueue();
      await loadHistory();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmMarkSent = async () => {
    if (!pending) return;
    if (pending.payoutMethod === "CASH" && !adminNote.trim()) {
      setErr("Internal note is required for cash payouts");
      return;
    }
    const path =
      pending.type === "customer"
        ? `/api/staff/fiat-withdrawals/customer/${pending.id}/mark-sent`
        : `/api/staff/fiat-withdrawals/driver/${pending.id}/mark-sent`;
    setSubmitting(true);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, adminNote: adminNote.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed");
      setDialogOpen(false);
      setPending(null);
      await loadQueue();
      await loadHistory();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const balanceForPending =
    pending?.type === "customer" ? pending.walletBalance : pending?.type === "driver" ? pending.accountBalance : 0;
  const netPayoutForPending = pending
    ? Math.round((pending.amount - (pending.feeAmount ?? 0)) * 100) / 100
    : 0;
  const totalDebitForPending = pending ? pending.amount : 0;
  const cashPayoutPending = pending?.payoutMethod === "CASH";

  const showCustomerQueue = roleFilter === "all" || roleFilter === "customer";
  const showDriverQueue = roleFilter === "all" || roleFilter === "driver";

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-cyan-50/50 via-background to-background dark:from-cyan-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-cyan-50/50 via-background to-background dark:from-cyan-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-cyan-600 via-teal-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Banknote className="h-3.5 w-3.5" />
                  Fiat payout desk
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Fiat payout queue</h1>
                <p className="max-w-xl text-sm text-white/80">
                  Review pending withdrawal requests, send funds manually, then mark as sent or reject with a reason.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 bg-white/15 text-white hover:bg-white/25 border-0"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Pending total", value: stats.pendingTotal, icon: Clock },
                { label: "Customers", value: stats.pendingCustomer, icon: User },
                { label: "Drivers", value: stats.pendingDriver, icon: Truck },
                { label: "Net coins (queue)", value: stats.totalNetCoins.toFixed(2), icon: Wallet },
                { label: "Insufficient bal.", value: stats.insufficient, icon: AlertTriangle },
                { label: "Completed", value: stats.historyCount, icon: CheckCircle2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {err && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {err}
          </div>
        )}

        {/* Filters */}
        <Card className="border-cyan-100/60 dark:border-cyan-900/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                Filters
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setRoleFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    roleFilter === f.value
                      ? "bg-cyan-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="w-px h-6 bg-border self-center mx-1 hidden sm:block" />
              {METHOD_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setMethodFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    methodFilter === f.value
                      ? "bg-teal-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs
          defaultValue="queue"
          onValueChange={(v) => {
            if (v === "history" && !historyFetched) {
              setHistoryFetched(true);
              void loadHistory();
            }
          }}
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="queue" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending ({stats.pendingTotal})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-6 space-y-6">
            {showCustomerQueue && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-cyan-600" />
                    Customer wallet → cash / bank
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    After you send money manually, mark as sent. The customer&apos;s coin balance will be reduced.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Bank details</TableHead>
                          <TableHead>Wallet bal.</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomer.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <CheckCircle2 className="h-8 w-8 opacity-40" />
                                <p>No pending customer withdrawals</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCustomer.map((r) => {
                            const name = r.customer?.name || "—";
                            const insufficient = r.amount > r.walletBalance;
                            return (
                              <TableRow key={r.id} className="hover:bg-muted/30">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 text-xs font-semibold dark:bg-cyan-900/40 dark:text-cyan-300">
                                      {initials(name)}
                                    </div>
                                    <div>
                                      <p className="font-medium">{name}</p>
                                      {r.customer?.phone ? (
                                        <p className="text-xs text-muted-foreground">{r.customer.phone}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <PayoutAmountCell
                                    grossCoins={r.amount}
                                    feeCoins={r.feeAmount ?? 0}
                                    netPayoutCoins={r.netPayoutCoins}
                                    netPayoutFiat={r.netPayoutFiat}
                                    grossDebitFiat={r.grossDebitFiat}
                                    currencyCode={r.currencyCode}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={methodBadgeClass(r.payoutMethod)}>
                                    {formatMethod(r.payoutMethod)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="align-top">
                                  <BankPayoutCell
                                    payoutMethod={r.payoutMethod}
                                    holder={r.payoutBankHolderName}
                                    bankName={r.payoutBankName}
                                    accountRef={r.payoutBankAccountRef}
                                  />
                                </TableCell>
                                <TableCell>
                                  <span className={`tabular-nums text-sm ${insufficient ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                    {r.walletBalance.toFixed(2)}
                                    {insufficient ? (
                                      <span className="block text-xs text-red-500">Insufficient</span>
                                    ) : null}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                  {formatDate(r.requestedAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => openReject("customer", r.id, `Customer ${name}`)}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-1" />
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={insufficient}
                                      onClick={() =>
                                        openMarkSent(
                                          { ...r, label: `Customer withdrawal (${name})` },
                                          "customer",
                                          r.walletBalance,
                                        )
                                      }
                                    >
                                      Money sent
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {showDriverQueue && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Truck className="h-5 w-5 text-teal-600" />
                    Driver account → cash / bank
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Marks the driver&apos;s in-app balance as paid out (coins / fiat ledger).
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Driver</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Bank details</TableHead>
                          <TableHead>Account bal.</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDriver.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <CheckCircle2 className="h-8 w-8 opacity-40" />
                                <p>No pending driver withdrawals</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDriver.map((r) => {
                            const name = r.driver?.name || "—";
                            const insufficient = r.amount > r.accountBalance;
                            return (
                              <TableRow key={r.id} className="hover:bg-muted/30">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-semibold dark:bg-teal-900/40 dark:text-teal-300">
                                      {initials(name)}
                                    </div>
                                    <div>
                                      <p className="font-medium">{name}</p>
                                      {r.driver?.phone ? (
                                        <p className="text-xs text-muted-foreground">{r.driver.phone}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <PayoutAmountCell
                                    grossCoins={r.amount}
                                    feeCoins={r.feeAmount ?? 0}
                                    netPayoutCoins={r.netPayoutCoins}
                                    netPayoutFiat={r.netPayoutFiat}
                                    grossDebitFiat={r.grossDebitFiat}
                                    currencyCode={r.currencyCode}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={methodBadgeClass(r.payoutMethod)}>
                                    {formatMethod(r.payoutMethod)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="align-top">
                                  <BankPayoutCell
                                    payoutMethod={r.payoutMethod}
                                    holder={r.payoutBankHolderName}
                                    bankName={r.payoutBankName}
                                    accountRef={r.payoutBankAccountRef}
                                  />
                                </TableCell>
                                <TableCell>
                                  <span className={`tabular-nums text-sm ${insufficient ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                    {r.accountBalance.toFixed(2)}
                                    {insufficient ? (
                                      <span className="block text-xs text-red-500">Insufficient</span>
                                    ) : null}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                  {formatDate(r.requestedAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-wrap gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => openReject("driver", r.id, `Driver ${name}`)}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-1" />
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={insufficient}
                                      onClick={() =>
                                        openMarkSent(
                                          { ...r, label: `Driver withdrawal (${name})` },
                                          "driver",
                                          r.accountBalance,
                                        )
                                      }
                                    >
                                      Money sent
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-muted-foreground" />
                  Completed fiat payouts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {histLoading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                    <History className="h-10 w-10 opacity-40" />
                    <p>No completed fiat payouts yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Role</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Bank details</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead>Processed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.map((r) => {
                          const name = r.role === "customer" ? r.customer?.name || "—" : r.driver?.name || "—";
                          return (
                            <TableRow key={`${r.role}-${r.id}`} className="hover:bg-muted/30">
                              <TableCell>
                                <Badge variant="outline" className={r.role === "customer" ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" : "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"}>
                                  {r.role === "customer" ? (
                                    <><User className="h-3 w-3 mr-1 inline" />Customer</>
                                  ) : (
                                    <><Truck className="h-3 w-3 mr-1 inline" />Driver</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                    {initials(name)}
                                  </div>
                                  <span className="font-medium">{name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <PayoutAmountCell
                                  grossCoins={r.amount}
                                  feeCoins={r.feeAmount ?? 0}
                                  netPayoutCoins={r.netPayoutCoins}
                                  netPayoutFiat={r.netPayoutFiat}
                                  grossDebitFiat={r.grossDebitFiat}
                                  currencyCode={r.currencyCode}
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={methodBadgeClass(r.payoutMethod)}>
                                  {r.payoutMethod === "BANK_TRANSFER" ? (
                                    <><Building2 className="h-3 w-3 mr-1 inline" />{formatMethod(r.payoutMethod)}</>
                                  ) : (
                                    <><Banknote className="h-3 w-3 mr-1 inline" />{formatMethod(r.payoutMethod)}</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                <BankPayoutCell
                                  payoutMethod={r.payoutMethod}
                                  holder={r.payoutBankHolderName}
                                  bankName={r.payoutBankName}
                                  accountRef={r.payoutBankAccountRef}
                                />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {formatDate(r.requestedAt)}
                              </TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {r.processedAt ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">{formatDate(r.processedAt)}</span>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setDialogStep("preview");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogStep === "preview" ? "Review payout" : "Confirm & record"}</DialogTitle>
            <DialogDescription className={dialogStep === "preview" ? "sr-only" : undefined}>
              {dialogStep === "confirm"
                ? cashPayoutPending
                  ? "Internal note is required for cash payouts (e.g. pickup location, reference)."
                  : "Optional internal note for your records."
                : null}
            </DialogDescription>
          </DialogHeader>

          {dialogStep === "preview" && pending ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{pending.label}</p>
              <div className="rounded-lg border bg-muted/30 px-4 py-6 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount to send</p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
                  {pending.netPayoutFiat != null
                    ? formatFiatAmount(pending.netPayoutFiat, pending.currencyCode)
                    : `${netPayoutForPending.toFixed(2)} coins`}
                </p>
                {pending.netPayoutFiat != null ? (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {netPayoutForPending.toFixed(2)} coins
                  </p>
                ) : null}
                {(pending.feeAmount ?? 0) > 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pending.feeAmount.toFixed(2)} coins fee (deducted)
                    {pending.grossDebitFiat != null
                      ? ` · ${formatFiatAmount(pending.grossDebitFiat, pending.currencyCode)} debited from wallet`
                      : ` · ${totalDebitForPending.toFixed(2)} coins debited from wallet`}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pending.grossDebitFiat != null ? (
                      <>
                        <strong>{formatFiatAmount(pending.grossDebitFiat, pending.currencyCode)}</strong> debited from
                        wallet
                      </>
                    ) : (
                      <>
                        <strong>{totalDebitForPending.toFixed(2)}</strong> coins debited from wallet
                      </>
                    )}
                  </p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Current {pending.type === "customer" ? "wallet" : "account"} balance (before marking sent)
                </p>
                <p className="text-sm tabular-nums text-muted-foreground/80">{balanceForPending.toFixed(2)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Only continue if you have actually sent{" "}
                <strong>
                  {pending.netPayoutFiat != null
                    ? formatFiatAmount(pending.netPayoutFiat, pending.currencyCode)
                    : `${netPayoutForPending.toFixed(2)} coins`}
                </strong>{" "}
                (cash or bank). Confirming will debit{" "}
                <strong>
                  {pending.grossDebitFiat != null
                    ? formatFiatAmount(pending.grossDebitFiat, pending.currencyCode)
                    : `${totalDebitForPending.toFixed(2)} coins`}
                </strong>{" "}
                from the user&apos;s balance
                {(pending.feeAmount ?? 0) > 0 ? ` (includes ${pending.feeAmount.toFixed(2)} coins platform fee)` : ""}.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="adminNote">
                Internal note{cashPayoutPending ? " (required for cash)" : " (optional)"}
              </Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  cashPayoutPending ? "e.g. handed cash at office, receipt #…" : "e.g. wired to bank ref …"
                }
                rows={3}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {dialogStep === "preview" ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogStep("confirm")} disabled={submitting}>
                  Continue — money sent
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogStep("preview")} disabled={submitting}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void confirmMarkSent()}
                  disabled={submitting || (cashPayoutPending && !adminNote.trim())}
                >
                  {submitting ? "Saving…" : "Confirm — record payout"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject payout</DialogTitle>
            <DialogDescription>
              {rejectTarget?.label ?? "Withdrawal request"} — provide a reason (required). The user will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Rejection reason</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this payout cannot be processed…"
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmReject()}
              disabled={submitting || !rejectReason.trim()}
            >
              {submitting ? "Rejecting…" : "Reject payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
