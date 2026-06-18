"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  Ban,
  ChevronRight,
  Clock,
  Filter,
  Search,
  ShieldAlert,
  ShieldOff,
  User,
} from "lucide-react";

type RestrictionRow = {
  id: string;
  type: string;
  reason: string;
  imposedBy: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  liftedAt: string | null;
  user: {
    id: string;
    firstName: string | null;
    secondName: string | null;
    phone: string | null;
    role: string;
  };
};

type StatusFilter = "all" | "active" | "lifted";
type TypeFilter = "all" | "SUSPENSION" | "BLOCK" | "WARNING";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "lifted", label: "Lifted" },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "SUSPENSION", label: "Suspension" },
  { value: "BLOCK", label: "Block" },
  { value: "WARNING", label: "Warning" },
];

function typeClass(type: string) {
  if (type === "BLOCK") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (type === "SUSPENSION") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
}

function formatLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function personName(user: RestrictionRow["user"]) {
  return `${user.firstName ?? ""} ${user.secondName ?? ""}`.trim() || "—";
}

function initials(user: RestrictionRow["user"]) {
  const name = personName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function RestrictionsClient({
  restrictions,
  stats,
}: {
  restrictions: RestrictionRow[];
  stats: {
    total: number;
    active: number;
    lifted: number;
    permanent: number;
    suspension: number;
    block: number;
    warning: number;
  };
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    let result = restrictions;
    if (statusFilter === "active") result = result.filter((r) => !r.liftedAt);
    else if (statusFilter === "lifted") result = result.filter((r) => r.liftedAt);
    if (typeFilter !== "all") result = result.filter((r) => r.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          personName(r.user).toLowerCase().includes(q) ||
          (r.user.phone || "").includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          r.imposedBy.toLowerCase().includes(q),
      );
    }
    return result;
  }, [restrictions, search, statusFilter, typeFilter]);

  return (
    <div className="min-h-full bg-gradient-to-b from-red-50/50 via-background to-background dark:from-red-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-red-600 via-rose-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <ShieldAlert className="h-3.5 w-3.5" />
                Account moderation
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">User restrictions</h1>
              <p className="max-w-xl text-sm text-white/80">
                View suspensions, blocks, and warnings imposed on users. Active restrictions limit platform access.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Total records", value: stats.total, icon: ShieldAlert },
                { label: "Active", value: stats.active, icon: Ban },
                { label: "Lifted", value: stats.lifted, icon: ShieldOff },
                { label: "Permanent", value: stats.permanent, icon: AlertTriangle },
                { label: "Suspensions", value: stats.suspension, icon: Clock },
                { label: "Blocks", value: stats.block, icon: Ban },
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

        {/* Filters */}
        <Card className="border-red-100/60 dark:border-red-900/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search user, reason, imposed by…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} of {restrictions.length} records
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
                      ? "bg-red-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="w-px h-6 bg-border self-center mx-1 hidden sm:block" />
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setTypeFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    typeFilter === f.value
                      ? "bg-rose-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Restriction records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <ShieldOff className="h-10 w-10 opacity-40" />
                <p>No restrictions match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setTypeFilter("all");
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
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Imposed by</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Profile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const name = personName(r.user);
                      const isActive = !r.liftedAt;
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30 align-top">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-semibold dark:bg-red-900/40 dark:text-red-300">
                                {initials(r.user)}
                              </div>
                              <div>
                                <p className="font-medium">{name}</p>
                                <Badge variant="outline" className="mt-0.5 text-xs">
                                  {r.user.role}
                                </Badge>
                                {r.user.phone ? (
                                  <p className="text-xs text-muted-foreground mt-0.5">{r.user.phone}</p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={typeClass(r.type)}>
                              {formatLabel(r.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="text-sm text-muted-foreground line-clamp-2">{r.reason}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                            {r.imposedBy === "system" ? "System" : r.imposedBy.slice(0, 8) + "…"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(r.startDate)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {r.endDate ? (
                              <span className="text-muted-foreground">{formatDate(r.endDate)}</span>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                Permanent
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Lifted
                                {r.liftedAt ? (
                                  <span className="block text-[10px] font-normal mt-0.5">{formatDate(r.liftedAt)}</span>
                                ) : null}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/dashboard/users/${r.user.id}`}
                              className="inline-flex items-center text-sm text-primary hover:underline"
                            >
                              <User className="h-3.5 w-3.5 mr-1" />
                              View
                              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Link>
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
