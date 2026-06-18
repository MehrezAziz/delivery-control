"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Truck,
  ShieldCheck,
  Clock,
  XCircle,
  CheckCircle2,
  FileWarning,
  Bot,
  ChevronRight,
  Phone,
  Car,
  ClipboardCheck,
  Filter,
} from "lucide-react";

export type DriverApprovalRow = {
  id: string;
  firstName: string;
  secondName: string;
  phone: string | null;
  vehicleType: string | null;
  status: string;
  documentType: string | null;
  recommendation: string;
  submittedAt: string | null;
};

const STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "REJECTED", label: "Rejected" },
  { value: "VERIFIED", label: "Verified" },
  { value: "ALL", label: "All statuses" },
] as const;

const RECOMMENDATION_OPTIONS = [
  { value: "ALL", label: "All AI results" },
  { value: "APPROVED", label: "Approve" },
  { value: "REVIEW", label: "Needs review" },
  { value: "REJECTED", label: "Reject" },
  { value: "PENDING_STAFF_REVIEW", label: "Staff review" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

function initials(first: string, second: string) {
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase() || "?";
}

function fullName(first: string, second: string) {
  return `${first} ${second}`.trim() || "—";
}

function driverStatusClass(status: string) {
  if (status === "VERIFIED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "PENDING_REVIEW") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (status === "REJECTED") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (status === "INCOMPLETE") return "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300";
  return "bg-muted text-muted-foreground";
}

function recommendationClass(rec: string) {
  if (rec === "APPROVED") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (rec === "REJECTED") return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300";
  if (rec === "REVIEW" || rec === "PENDING_STAFF_REVIEW") return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30";
  return "bg-muted/50 text-muted-foreground border-border";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DriversApprovalClient({
  drivers,
  filters,
  stats,
}: {
  drivers: DriverApprovalRow[];
  filters: { status: string; recommendation: string; sort: string };
  stats: { pending: number; incomplete: number; rejected: number; verified: number };
}) {
  const router = useRouter();

  function applyFilters(patch: Partial<typeof filters>) {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    if (next.status && next.status !== "PENDING_REVIEW") params.set("status", next.status);
    if (next.recommendation && next.recommendation !== "ALL") params.set("recommendation", next.recommendation);
    if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
    const qs = params.toString();
    router.push(qs ? `/dashboard/drivers?${qs}` : "/dashboard/drivers");
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-sky-50/60 via-background to-background dark:from-sky-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-600 via-blue-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_55%)]" />
          <div className="relative p-6 sm:p-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Verification queue
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Truck className="h-8 w-8 opacity-90" />
              Driver Approval
            </h1>
            <p className="text-sky-100 text-sm max-w-2xl">
              Review driver applications, check AI document recommendations, and approve or reject
              candidates manually.
            </p>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/15">
            <HeroStat icon={<Clock className="h-3.5 w-3.5" />} label="Pending" value={stats.pending} />
            <HeroStat icon={<FileWarning className="h-3.5 w-3.5" />} label="Incomplete" value={stats.incomplete} />
            <HeroStat icon={<XCircle className="h-3.5 w-3.5" />} label="Rejected" value={stats.rejected} />
            <HeroStat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Verified" value={stats.verified} />
          </div>
        </div>

        {/* Filters */}
        <Card className="overflow-hidden border-sky-200/50 dark:border-sky-800/30">
          <div className="h-0.5 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-sky-600" />
              Review queue
              <Badge variant="secondary" className="font-normal ml-1">
                {drivers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => applyFilters({ status: opt.value })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      filters.status === opt.value
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="space-y-2 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  AI recommendation
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {RECOMMENDATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => applyFilters({ recommendation: opt.value })}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        filters.recommendation === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant={filters.sort === "newest" ? "default" : "outline"}
                  size="sm"
                  className={filters.sort === "newest" ? "bg-sky-600 hover:bg-sky-700" : ""}
                  onClick={() => applyFilters({ sort: "newest" })}
                >
                  Newest
                </Button>
                <Button
                  variant={filters.sort === "oldest" ? "default" : "outline"}
                  size="sm"
                  className={filters.sort === "oldest" ? "bg-sky-600 hover:bg-sky-700" : ""}
                  onClick={() => applyFilters({ sort: "oldest" })}
                >
                  Oldest
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {drivers.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-sky-600" />
                </div>
                <p className="font-medium">No drivers in this queue</p>
                <p className="text-sm text-muted-foreground">Try another status or AI filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/30">
                      <TableHead>Driver</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>AI recommendation</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((d) => (
                      <TableRow
                        key={d.id}
                        className="group hover:bg-sky-50/50 dark:hover:bg-sky-950/15"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-semibold">
                              {initials(d.firstName, d.secondName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{fullName(d.firstName, d.secondName)}</p>
                              {d.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3" />
                                  {d.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Car className="h-3.5 w-3.5 text-muted-foreground" />
                            {d.vehicleType || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${driverStatusClass(d.status)}`}
                          >
                            {formatLabel(d.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {d.documentType ? (
                            <Badge variant="outline" className="font-normal text-xs">
                              {formatLabel(d.documentType)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${recommendationClass(d.recommendation)}`}
                          >
                            {formatLabel(d.recommendation)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/drivers/${d.id}`}>
                            <Button
                              size="sm"
                              className="bg-sky-600 hover:bg-sky-700 opacity-90 group-hover:opacity-100"
                            >
                              Review
                              <ChevronRight className="h-4 w-4 ml-0.5" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
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
  value: number;
}) {
  return (
    <div className="px-4 py-3 text-center sm:px-5">
      <div className="flex items-center justify-center gap-1.5 text-sky-200 text-[10px] uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
