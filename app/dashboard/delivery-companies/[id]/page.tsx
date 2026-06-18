"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Mail,
  Landmark,
  Layers,
  ScrollText,
  Scale,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function DeliveryCompanyDetailsPage() {
  const params = useParams<{ id: string }>();
  const [company, setCompany] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [deptLabel, setDeptLabel] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankIban, setBankIban] = useState("");

  const load = async () => {
    setLoading(true);
    const [companiesRes, deptRes, bankRes, logRes, reconRes] = await Promise.all([
      fetch("/api/delivery-companies").then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/departments`).then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/bank-accounts`).then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/audit-logs`).then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/reconciliation`).then((r) => r.json()),
    ]);
    setCompany((Array.isArray(companiesRes) ? companiesRes : []).find((c: any) => c.id === params.id) || null);
    setDepartments(Array.isArray(deptRes) ? deptRes : []);
    setBankAccounts(Array.isArray(bankRes) ? bankRes : []);
    setAuditLogs(Array.isArray(logRes) ? logRes : []);
    setRecon(reconRes || null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const addDepartment = async () => {
    const res = await fetch(`/api/delivery-companies/${params.id}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: deptLabel }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to add department");
    setDeptLabel("");
    setMessage(null);
    await load();
  };

  const addBank = async () => {
    const res = await fetch(`/api/delivery-companies/${params.id}/bank-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountHolderName: bankHolder, iban: bankIban }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to add bank");
    setBankHolder("");
    setBankIban("");
    setMessage(null);
    await load();
  };

  if (loading && !company) {
    return (
      <div className="min-h-full bg-gradient-to-b from-blue-50/50 via-background to-background dark:from-blue-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const reconDiff = Number(recon?.difference || 0);
  const reconBalanced = Math.abs(reconDiff) < 0.01;

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50/50 via-background to-background dark:from-blue-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard/delivery-companies"
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "bg-white/15 text-white border-white/20 hover:bg-white/25",
                    )}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                    Back to companies
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/10 text-white border-white/15 hover:bg-white/20"
                    onClick={() => void load()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <Building2 className="h-8 w-8 opacity-90" />
                  {company?.name || "Company"}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {company?.status && (
                    <Badge className="bg-white/15 text-white border-white/20">{company.status}</Badge>
                  )}
                  {company?.contactEmail && (
                    <Badge className="bg-white/10 text-white/95 border-white/15 gap-1">
                      <Mail className="h-3 w-3" />
                      {company.contactEmail}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/15">
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-blue-200">Departments</p>
              <p className="text-lg font-bold tabular-nums">{departments.length}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-blue-200">Bank accounts</p>
              <p className="text-lg font-bold tabular-nums">{bankAccounts.length}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-blue-200">Discount</p>
              <p className="text-lg font-bold tabular-nums">{company?.defaultDiscountPercent ?? "—"}%</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-blue-200">Max negative</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{company?.maxNegativeBalance ?? "—"}</p>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {message}
          </div>
        )}

        <Card className="overflow-hidden border-blue-200/50 dark:border-blue-800/30">
          <div className="h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              Company overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Name", value: company?.name || "—" },
                { label: "Email", value: company?.contactEmail || "—" },
                { label: "Status", value: company?.status || "—" },
                { label: "Default discount", value: `${company?.defaultDiscountPercent ?? "—"}%` },
                { label: "Max negative balance", value: company?.maxNegativeBalance ?? "—" },
              ].map((row) => (
                <div key={row.label} className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
                  <p className="text-sm font-medium">{row.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-600" />
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Department label"
                  value={deptLabel}
                  onChange={(e) => setDeptLabel(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addDepartment} disabled={!deptLabel.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No departments yet</p>
                ) : (
                  departments.map((d) => (
                    <div key={d.id} className="rounded-xl border p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <span className="font-medium text-sm">{d.label}</span>
                      <span className="text-xs text-muted-foreground font-mono">{d.id.slice(0, 8)}…</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-600" />
                Bank accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Account holder" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
                <Input placeholder="IBAN" value={bankIban} onChange={(e) => setBankIban(e.target.value)} />
                <Button onClick={addBank} disabled={!bankHolder.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {bankAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No bank accounts</p>
                ) : (
                  bankAccounts.map((b) => (
                    <div key={b.id} className="rounded-xl border p-3 hover:bg-muted/30 transition-colors">
                      <p className="font-medium text-sm">{b.accountHolderName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{b.iban || "—"}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={cn("overflow-hidden", !reconBalanced && "border-amber-300 dark:border-amber-700")}>
          <div className={cn("h-0.5 bg-gradient-to-r", reconBalanced ? "from-emerald-500 to-teal-500" : "from-amber-500 to-orange-500")} />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-600" />
              Reconciliation
              {!reconBalanced && (
                <Badge variant="outline" className="text-amber-700 border-amber-300">Mismatch</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground">Orders total</p>
                <p className="text-xl font-bold tabular-nums mt-1">{Number(recon?.orderTotal || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground">Transactions total</p>
                <p className="text-xl font-bold tabular-nums mt-1">{Number(recon?.txTotal || 0).toFixed(2)}</p>
              </div>
              <div className={cn("rounded-xl border p-4 text-center", !reconBalanced && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20")}>
                <p className="text-xs text-muted-foreground">Difference</p>
                <p className={cn("text-xl font-bold tabular-nums mt-1", !reconBalanced && "text-amber-700 dark:text-amber-400")}>
                  {reconDiff.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-slate-500 to-stone-500" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-slate-600" />
              Audit log
              <Badge variant="secondary" className="tabular-nums">{auditLogs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No audit entries</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">{log.actionType}</p>
                      <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{log.actorType}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
