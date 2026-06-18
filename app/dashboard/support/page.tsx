"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChevronRight,
  Clock,
  Filter,
  Headphones,
  MessageSquare,
  RefreshCw,
  Search,
  User,
  UserCheck,
} from "lucide-react";

interface Ticket {
  id: string;
  userId: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdAt: string;
  user: { id: string; firstName: string | null; secondName: string | null; role: string; phone: string | null };
  customerService: { superUser: { pseudo: string } } | null;
  messages: { content: string; senderType: string; timestamp: string }[];
}

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

function statusClass(status: string) {
  if (status === "OPEN") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (status === "RESOLVED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  return "bg-muted text-muted-foreground";
}

function priorityClass(priority: string) {
  if (priority === "URGENT" || priority === "HIGH") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (priority === "MEDIUM") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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

function initials(first?: string | null, second?: string | null) {
  const name = `${first ?? ""} ${second ?? ""}`.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError("");
    const url = filter === "ALL" ? "/api/cs/support" : `/api/cs/support?status=${filter}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error);
      }
      setTickets(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    }
  }, [filter]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === "OPEN").length;
    const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const resolved = tickets.filter((t) => t.status === "RESOLVED").length;
    const unassigned = tickets.filter((t) => !t.customerService).length;
    return { open, inProgress, resolved, unassigned };
  }, [tickets]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(
      (t) =>
        `${t.user.firstName ?? ""} ${t.user.secondName ?? ""}`.toLowerCase().includes(q) ||
        (t.user.phone || "").includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.customerService?.superUser.pseudo || "").toLowerCase().includes(q),
    );
  }, [tickets, search]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-sky-50/50 via-background to-background dark:from-sky-950/10">
        <div className="space-y-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-sky-50/50 via-background to-background dark:from-sky-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-600 via-blue-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Headphones className="h-3.5 w-3.5" />
                  Human support desk
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Support tickets</h1>
                <p className="max-w-xl text-sm text-white/80">
                  Admin view of all customer and driver support conversations. Open a ticket to view the full chat.
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
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total in view", value: tickets.length, icon: MessageSquare },
                { label: "Open", value: stats.open, icon: Clock },
                { label: "In progress", value: stats.inProgress, icon: UserCheck },
                { label: "Unassigned", value: stats.unassigned, icon: User },
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

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Filters */}
        <Card className="border-sky-100/60 dark:border-sky-900/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search user, category, description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f.value
                      ? "bg-sky-600 text-white"
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
            <CardTitle className="text-lg">All tickets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <MessageSquare className="h-10 w-10 opacity-40" />
                <p>No tickets match your filters.</p>
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>User</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned to</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const userName = `${t.user.firstName ?? ""} ${t.user.secondName ?? ""}`.trim() || "—";
                      return (
                        <TableRow key={t.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-xs font-semibold dark:bg-sky-900/40 dark:text-sky-300">
                                {initials(t.user.firstName, t.user.secondName)}
                              </div>
                              <div>
                                <p className="font-medium">{userName}</p>
                                <Badge variant="outline" className="mt-0.5 text-xs">
                                  {t.user.role}
                                </Badge>
                                {t.user.phone ? (
                                  <p className="text-xs text-muted-foreground mt-0.5">{t.user.phone}</p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{formatLabel(t.category)}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{t.description}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={priorityClass(t.priority)}>
                              {t.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusClass(t.status)}>
                              {formatLabel(t.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.customerService?.superUser.pseudo ? (
                              <span className="inline-flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                                {t.customerService.superUser.pseudo}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{t.messages.length}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(t.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/dashboard/support/${t.id}`}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                            >
                              View chat
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
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
