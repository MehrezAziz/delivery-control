"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowRight,
  ClipboardList,
  Filter,
  History,
  Search,
  Shield,
  User,
  UserCog,
} from "lucide-react";

type LogRow = {
  id: string;
  actorId: string;
  actorRole: string;
  actionType: string;
  targetType: string;
  targetId: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  actorPseudo: string;
};

type RoleFilter = "all" | "ADMIN" | "CUSTOMER_SERVICE";

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "CUSTOMER_SERVICE", label: "Customer service" },
];

function roleClass(role: string) {
  if (role === "ADMIN") return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
  return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300";
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

function formatLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(value: string | null, max = 60) {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) + "…" : value;
}

export default function ActionLogsClient({
  logs,
  stats,
}: {
  logs: LogRow[];
  stats: {
    total: number;
    adminCount: number;
    csCount: number;
    withChanges: number;
    actors: number;
  };
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const actionTypes = useMemo(() => {
    const set = new Set(logs.map((l) => l.actionType));
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (roleFilter !== "all") result = result.filter((l) => l.actorRole === roleFilter);
    if (actionFilter !== "all") result = result.filter((l) => l.actionType === actionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.actorPseudo.toLowerCase().includes(q) ||
          l.actionType.toLowerCase().includes(q) ||
          l.targetType.toLowerCase().includes(q) ||
          l.targetId.toLowerCase().includes(q) ||
          (l.reason || "").toLowerCase().includes(q) ||
          (l.oldValue || "").toLowerCase().includes(q) ||
          (l.newValue || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [logs, search, roleFilter, actionFilter]);

  return (
    <div className="min-h-full bg-gradient-to-b from-stone-50/50 via-background to-background dark:from-stone-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-stone-600 via-zinc-600 to-slate-800 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <ClipboardList className="h-3.5 w-3.5" />
                Audit trail
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Action logs</h1>
              <p className="max-w-xl text-sm text-white/80">
                Immutable record of admin and customer-service actions across the platform (latest 200 entries).
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Total entries", value: stats.total, icon: History },
                { label: "Admin actions", value: stats.adminCount, icon: Shield },
                { label: "CS actions", value: stats.csCount, icon: UserCog },
                { label: "With changes", value: stats.withChanges, icon: ArrowRight },
                { label: "Unique actors", value: stats.actors, icon: User },
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
        <Card className="border-stone-200/60 dark:border-stone-800/60">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search actor, action, target, reason…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} of {logs.length} entries
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
                      ? "bg-stone-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {actionTypes.length > 0 && (
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setActionFilter("all")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    actionFilter === "all"
                      ? "bg-zinc-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  All actions
                </button>
                {actionTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActionFilter(type)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors font-mono ${
                      actionFilter === type
                        ? "bg-zinc-600 text-white"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <ClipboardList className="h-10 w-10 opacity-40" />
                <p>No action logs match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("all");
                    setActionFilter("all");
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
                      <TableHead>Date</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30 align-top">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 text-xs font-semibold dark:bg-stone-900/40 dark:text-stone-300">
                              {log.actorPseudo.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{log.actorPseudo}</p>
                              <Badge variant="outline" className={`mt-0.5 text-[10px] ${roleClass(log.actorRole)}`}>
                                {formatLabel(log.actorRole)}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.actionType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground">{formatLabel(log.targetType)}</p>
                          <p className="font-mono text-xs mt-0.5">{log.targetId.slice(0, 12)}…</p>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          {log.oldValue || log.newValue ? (
                            <div className="text-xs space-y-1">
                              {log.oldValue ? (
                                <p className="text-red-600 dark:text-red-400 line-through break-all">
                                  {truncate(log.oldValue)}
                                </p>
                              ) : null}
                              {log.oldValue && log.newValue ? (
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              ) : null}
                              {log.newValue ? (
                                <p className="text-emerald-600 dark:text-emerald-400 break-all">
                                  {truncate(log.newValue)}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <p className="text-xs text-muted-foreground line-clamp-3">{log.reason || "—"}</p>
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
