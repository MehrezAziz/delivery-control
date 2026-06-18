"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Filter,
  History,
  Layers,
  RefreshCw,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";

type Row = {
  id: string;
  amountCoins: string | number;
  priority: string;
  status: string;
  createdAt: string;
  decisionNote?: string | null;
  deliveryCompany?: { id?: string; name: string } | null;
  department?: { label: string; isMainDepartment?: boolean } | null;
};

type CompanyOpt = { id: string; name: string; coinBalance?: unknown; lockedCoins?: unknown };

type AuditRow = {
  id: string;
  actionType: string;
  actorType: string;
  actorRef: string | null;
  details: unknown;
  createdAt: string;
  deliveryCompany?: { id: string; name: string };
};

type StatusFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

type DeliveryCompanyBudgetsPanelProps = {
  showFinanceAdjust?: boolean;
};

function statusClass(status: string) {
  if (status === "PENDING") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "REJECTED") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

function priorityClass(priority: string) {
  if (priority === "HIGH" || priority === "URGENT") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (priority === "MEDIUM") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
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

function formatAuditDetails(details: unknown) {
  if (typeof details !== "object" || details === null) return String(details ?? "");
  const d = details as Record<string, unknown>;
  const parts: string[] = [];
  if (d.amountCoins != null) parts.push(`amount: ${d.amountCoins}`);
  if (d.balanceAfter != null) parts.push(`balance: ${d.balanceAfter}`);
  if (d.reason) parts.push(`reason: ${d.reason}`);
  if (d.decision) parts.push(`decision: ${d.decision}`);
  return parts.length > 0 ? parts.join(" · ") : JSON.stringify(details);
}

export function DeliveryCompanyBudgetsPanel({ showFinanceAdjust = true }: DeliveryCompanyBudgetsPanelProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("error");

  const [companyId, setCompanyId] = useState("");
  const [budgetFilterCompanyId, setBudgetFilterCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/delivery-companies/budget-requests");
    const data = await res.json();
    if (!res.ok) {
      setMessageType("error");
      setMessage(data?.error || "Failed to load budget requests");
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, []);

  const loadCompanies = useCallback(async () => {
    const res = await fetch("/api/delivery-companies");
    const data = await res.json();
    if (!res.ok) return;
    setCompanies(Array.isArray(data) ? data : []);
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/delivery-companies/finance-audit?take=80");
    const data = await res.json();
    if (!res.ok) return;
    setAudit(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([load(), loadCompanies(), loadAudit()]);
      setLoading(false);
    })();
  }, [load, loadCompanies, loadAudit]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "PENDING").length;
    const approved = rows.filter((r) => r.status === "APPROVED").length;
    const rejected = rows.filter((r) => r.status === "REJECTED").length;
    const pendingCoins = rows
      .filter((r) => r.status === "PENDING")
      .reduce((s, r) => s + Number(r.amountCoins || 0), 0);
    const totalBalance = companies.reduce((s, c) => s + Number(c.coinBalance ?? 0), 0);
    return { pending, approved, rejected, pendingCoins, totalBalance, auditCount: audit.length };
  }, [rows, companies, audit]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (budgetFilterCompanyId) {
      result = result.filter((r) => r.deliveryCompany?.id === budgetFilterCompanyId);
    }
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.deliveryCompany?.name || "").toLowerCase().includes(q) ||
          (r.department?.label || "").toLowerCase().includes(q) ||
          (r.decisionNote || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, budgetFilterCompanyId, statusFilter, search]);

  const groupedBudgetRows = useMemo(() => {
    const map = new Map<string, { companyName: string; rows: Row[] }>();
    for (const r of filteredRows) {
      const cid = r.deliveryCompany?.id || "_unknown";
      const name = r.deliveryCompany?.name || "Unknown company";
      if (!map.has(cid)) map.set(cid, { companyName: name, rows: [] });
      map.get(cid)!.rows.push(r);
    }
    return [...map.entries()].sort((a, b) => a[1].companyName.localeCompare(b[1].companyName));
  }, [filteredRows]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadCompanies(), loadAudit()]);
    setRefreshing(false);
  }

  async function update(id: string, status: "APPROVED" | "REJECTED") {
    setUpdatingId(id);
    setMessage(null);
    const idemKey = buildIdempotencyKey("admin-deliverycompany-budget-decision", { id, status });
    try {
      const res = await fetch(`/api/delivery-companies/budget-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data?.error || "Failed to update");
        return;
      }
      setMessageType("success");
      setMessage(`Budget request ${status === "APPROVED" ? "approved" : "rejected"}.`);
      await load();
      await loadAudit();
    } catch {
      setMessageType("error");
      setMessage("Network error while updating request");
    } finally {
      setUpdatingId(null);
    }
  }

  async function submitAdjust(sign: 1 | -1) {
    setMessage(null);
    const raw = parseFloat(String(adjustAmount).replace(",", "."));
    if (!companyId) {
      setMessageType("error");
      setMessage("Select a company");
      return;
    }
    if (!Number.isFinite(raw) || raw <= 0) {
      setMessageType("error");
      setMessage("Enter a positive amount");
      return;
    }
    const amountCoins = Math.round(raw * sign * 100) / 100;
    const idemKey = buildIdempotencyKey("company-finance-adjust", {
      companyId,
      amountCoins,
      reason: adjustReason,
    });
    setAdjustBusy(true);
    try {
      const res = await fetch("/api/delivery-companies/finance-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({
          deliveryCompanyId: companyId,
          amountCoins,
          reason: adjustReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data?.error || "Adjustment failed");
        return;
      }
      setMessageType("success");
      setMessage(
        `Updated balance: ${Number(data.balanceAfter ?? 0).toFixed(2)} coins (${amountCoins >= 0 ? "+" : ""}${amountCoins.toFixed(2)})`,
      );
      setAdjustAmount("");
      setAdjustReason("");
      await loadCompanies();
      await loadAudit();
    } finally {
      setAdjustBusy(false);
    }
  }

  const selected = companies.find((c) => c.id === companyId);
  const availableBalance = selected
    ? Number(selected.coinBalance ?? 0) - Number(selected.lockedCoins ?? 0)
    : 0;

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 via-purple-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                {showFinanceAdjust && (
                  <Link
                    href="/dashboard/delivery-companies"
                    className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Delivery companies
                  </Link>
                )}
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Layers className="h-3.5 w-3.5" />
                  Budget & wallet desk
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Delivery company budgets & wallet</h1>
                <p className="max-w-xl text-sm text-white/80">
                  {showFinanceAdjust
                    ? "Approve department budget requests and adjust company main wallet balances with full audit trail."
                    : "Review and approve department budget requests for companies in your scope."}
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
                { label: "Companies", value: companies.length, icon: Building2 },
                { label: "Pending requests", value: stats.pending, icon: Clock },
                { label: "Approved", value: stats.approved, icon: CheckCircle2 },
                { label: "Pending coins", value: stats.pendingCoins.toFixed(2), icon: Coins },
                { label: "Total balance", value: stats.totalBalance.toFixed(2), icon: Wallet },
                { label: "Audit entries", value: stats.auditCount, icon: History },
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
            {showFinanceAdjust && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/dashboard/delivery-companies/refunds"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20 transition-colors"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Refund approvals
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
              messageType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
          >
            {messageType === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {message}
          </div>
        )}

        {/* Wallet adjust */}
        {showFinanceAdjust && (
          <Card className="border-violet-100/60 dark:border-violet-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-violet-600" />
                Company wallet adjustment
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Add or withdraw coins from a company&apos;s main wallet. Withdrawals use available balance (total minus locked reserves).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="">— Select company —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (coins)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="e.g. 100"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Reason (optional)</Label>
                  <Input
                    placeholder="Shown in audit and company notification"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                </div>
              </div>

              {selected && (
                <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Main balance</p>
                    <p className="font-semibold tabular-nums">{Number(selected.coinBalance ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Locked</p>
                    <p className="font-semibold tabular-nums text-amber-600">{Number(selected.lockedCoins ?? 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="font-semibold tabular-nums text-emerald-600">{availableBalance.toFixed(2)}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button disabled={adjustBusy || !companyId} onClick={() => void submitAdjust(1)}>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Add coins
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  disabled={adjustBusy || !companyId}
                  onClick={() => void submitAdjust(-1)}
                >
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Withdraw coins
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Budget requests */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-violet-600" />
              Department budget requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search company or department…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="space-y-2 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Filter by company</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={budgetFilterCompanyId}
                  onChange={(e) => setBudgetFilterCompanyId(e.target.value)}
                >
                  <option value="">All companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-violet-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="text-sm text-muted-foreground ml-2">
                {filteredRows.length} request{filteredRows.length !== 1 ? "s" : ""}
              </span>
            </div>

            {groupedBudgetRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Layers className="h-10 w-10 opacity-40" />
                <p>No budget requests match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setBudgetFilterCompanyId("");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedBudgetRows.map(([cid, group]) => (
                  <Card key={cid} className="overflow-hidden">
                    <CardHeader className="py-3 bg-muted/30 border-b">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-semibold dark:bg-violet-900/40 dark:text-violet-300">
                          {initials(group.companyName)}
                        </div>
                        <div>
                          <CardTitle className="text-base">{group.companyName}</CardTitle>
                          <p className="text-xs text-muted-foreground">{group.rows.length} request(s)</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableHead>Department</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Priority</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Requested</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.rows.map((r) => {
                              const busy = updatingId === r.id;
                              return (
                                <TableRow key={r.id} className="hover:bg-muted/30 align-top">
                                  <TableCell>
                                    <p className="font-medium">{r.department?.label || "Department"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {r.department?.isMainDepartment ? "Main department" : "Sub-department"}
                                    </p>
                                    {r.decisionNote ? (
                                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.decisionNote}</p>
                                    ) : null}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-lg font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                                      {Number(r.amountCoins || 0).toFixed(2)}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">coins</span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={priorityClass(r.priority)}>
                                      {r.priority}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={statusClass(r.status)}>
                                      {formatStatus(r.status)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                    {formatDate(r.createdAt)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {r.status === "PENDING" ? (
                                      <div className="flex flex-wrap gap-2 justify-end">
                                        <Button size="sm" disabled={busy} onClick={() => void update(r.id, "APPROVED")}>
                                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                          Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-red-600 hover:text-red-700"
                                          disabled={busy}
                                          onClick={() => void update(r.id, "REJECTED")}
                                        >
                                          <XCircle className="h-3.5 w-3.5 mr-1" />
                                          Reject
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit log */}
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setAuditOpen((o) => !o)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-muted-foreground" />
                Finance adjustment audit
                <Badge variant="secondary" className="ml-1">{audit.length}</Badge>
              </CardTitle>
              <span className="text-xs text-muted-foreground">{auditOpen ? "Hide" : "Show"}</span>
            </div>
          </CardHeader>
          {auditOpen && (
            <CardContent className="p-0">
              {audit.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <History className="h-8 w-8 opacity-40" />
                  <p>No finance adjustments yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>When</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((a) => (
                        <TableRow key={a.id} className="hover:bg-muted/30">
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(a.createdAt)}
                          </TableCell>
                          <TableCell className="font-medium">{a.deliveryCompany?.name || "—"}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline">{a.actorType}</Badge>
                            {a.actorRef ? (
                              <span className="block text-xs text-muted-foreground font-mono mt-1">
                                {a.actorRef.slice(0, 8)}…
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-md">
                            <span className="font-medium text-foreground">{a.actionType}</span>
                            <p className="text-xs mt-0.5">{formatAuditDetails(a.details)}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
