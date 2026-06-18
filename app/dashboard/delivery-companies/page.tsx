"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2,
  ChevronRight,
  Clock,
  Coins,
  Filter,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  Truck,
  Wallet,
  X,
} from "lucide-react";

type DeliveryCompany = {
  id: string;
  name: string;
  contactEmail?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  status: string;
  coinBalance: string | number;
  maxNegativeBalance: string | number;
  defaultDiscountPercent?: string | number | null;
};

type StatusFilter = "all" | "ACTIVE" | "PENDING" | "SUSPENDED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "SUSPENDED", label: "Suspended" },
];

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "PENDING") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (status === "SUSPENDED") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function DeliveryCompaniesPage() {
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editMaxNegativeBalance, setEditMaxNegativeBalance] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<string>("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery-companies");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCompanies(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load delivery companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const totalBalance = companies.reduce((sum, c) => sum + Number(c.coinBalance || 0), 0);
    const active = companies.filter((c) => c.status === "ACTIVE").length;
    const pending = companies.filter((c) => c.status === "PENDING").length;
    const suspended = companies.filter((c) => c.status === "SUSPENDED").length;
    const inDebt = companies.filter((c) => Number(c.coinBalance) < 0).length;
    return { totalBalance, active, pending, suspended, inDebt };
  }, [companies]);

  const filtered = useMemo(() => {
    let result = companies;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.contactEmail || "").toLowerCase().includes(q) ||
          (c.legalName || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    return result;
  }, [companies, search, statusFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function createCompany() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: contactEmail.trim() || null,
          password: initialPassword || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Creation failed");
      setName("");
      setContactEmail("");
      setInitialPassword("");
      setShowCreate(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(company: DeliveryCompany) {
    setEditingId(company.id);
    setEditName(company.name);
    setEditStatus(company.status || "ACTIVE");
    setEditEmail(company.contactEmail || "");
    setEditPassword("");
    setEditMaxNegativeBalance(Number(company.maxNegativeBalance || 0));
    setEditDiscount(
      company.defaultDiscountPercent !== undefined && company.defaultDiscountPercent !== null
        ? String(company.defaultDiscountPercent)
        : "",
    );
  }

  async function saveEdit(companyId: string) {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        status: editStatus,
        contactEmail: editEmail.trim() || null,
        maxNegativeBalance: editMaxNegativeBalance,
      };
      if (editPassword.trim() !== "") payload.password = editPassword.trim();
      payload.defaultDiscountPercent = editDiscount.trim() !== "" ? Number(editDiscount) : null;

      const res = await fetch(`/api/delivery-companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-blue-50/50 via-background to-background dark:from-blue-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50/50 via-background to-background dark:from-blue-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Building2 className="h-3.5 w-3.5" />
                  Partner management
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Delivery companies</h1>
                <p className="max-w-xl text-sm text-white/80">
                  Manage partner accounts, coin balances, credit limits, and access to refunds and budgets.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white hover:bg-white/25 border-0"
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  className="bg-white text-blue-700 hover:bg-white/90"
                  onClick={() => setShowCreate((s) => !s)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New company
                </Button>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Companies", value: companies.length, icon: Building2 },
                { label: "Active", value: stats.active, icon: Truck },
                { label: "Pending", value: stats.pending, icon: Clock },
                { label: "Suspended", value: stats.suspended, icon: X },
                { label: "Total balance", value: stats.totalBalance.toFixed(2), icon: Coins },
                { label: "In debt", value: stats.inDebt, icon: TrendingDown },
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dashboard/delivery-companies/refunds"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20 transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                Refund approvals
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/delivery-companies/budgets"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20 transition-colors"
              >
                <Coins className="h-3.5 w-3.5" />
                Budgets & wallet
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <Card className="border-blue-100/60 dark:border-blue-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5 text-blue-600" />
                Create delivery company
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Logistics"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact email</Label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="ops@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial password</Label>
                  <Input
                    type="password"
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={() => void createCompany()} disabled={saving || !name.trim()} className="flex-1">
                    {saving ? "Creating…" : "Create company"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} of {companies.length} companies
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-blue-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Company table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Company directory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Building2 className="h-10 w-10 opacity-40" />
                <p>No delivery companies match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Coin balance</TableHead>
                      <TableHead>Max negative</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const balance = Number(c.coinBalance);
                      const isEditing = editingId === c.id;

                      if (isEditing) {
                        return (
                          <TableRow key={c.id} className="bg-muted/20">
                            <TableCell colSpan={7}>
                              <div className="space-y-4 py-2">
                                <p className="text-sm font-medium flex items-center gap-2">
                                  <Pencil className="h-4 w-4" />
                                  Editing {c.name}
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Name</Label>
                                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Email</Label>
                                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">New password</Label>
                                    <Input
                                      type="password"
                                      value={editPassword}
                                      onChange={(e) => setEditPassword(e.target.value)}
                                      placeholder="Leave blank to keep"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Status</Label>
                                    <select
                                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                      value={editStatus}
                                      onChange={(e) => setEditStatus(e.target.value)}
                                    >
                                      <option value="PENDING">Pending</option>
                                      <option value="ACTIVE">Active</option>
                                      <option value="SUSPENDED">Suspended</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Max negative balance</Label>
                                    <Input
                                      type="number"
                                      value={editMaxNegativeBalance}
                                      onChange={(e) => setEditMaxNegativeBalance(Number(e.target.value))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Discount %</Label>
                                    <Input
                                      type="number"
                                      value={editDiscount}
                                      onChange={(e) => setEditDiscount(e.target.value)}
                                      placeholder="Optional"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => void saveEdit(c.id)} disabled={saving || !editName.trim()}>
                                    {saving ? "Saving…" : "Save changes"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={c.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold dark:bg-blue-900/40 dark:text-blue-300">
                                {initials(c.name)}
                              </div>
                              <div>
                                <p className="font-medium">{c.name}</p>
                                {c.legalName ? (
                                  <p className="text-xs text-muted-foreground">{c.legalName}</p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusClass(c.status)}>
                              {formatStatus(c.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {c.contactEmail ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                {c.contactEmail}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`tabular-nums font-medium ${
                                balance < 0 ? "text-red-600" : balance > 0 ? "text-emerald-600" : "text-muted-foreground"
                              }`}
                            >
                              {balance.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {Number(c.maxNegativeBalance).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {c.defaultDiscountPercent != null ? (
                              <Badge variant="secondary">{Number(c.defaultDiscountPercent)}%</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Edit
                              </Button>
                              <Link
                                href={`/dashboard/delivery-companies/${c.id}`}
                                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                              >
                                Details
                                <ChevronRight className="h-3.5 w-3.5 ml-1" />
                              </Link>
                            </div>
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
      </div>
    </div>
  );
}
