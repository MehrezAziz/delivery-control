"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bot,
  CheckCircle2,
  Cpu,
  Filter,
  MessageSquare,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { AiSupportRuntimeToggle } from "./ai-support-runtime-toggle";

export type AiSupportDashboardData = {
  periodDays: number;
  since: string;
  feedback: { helpful: number; notHelpful: number; total: number };
  escalationsWithHumanRequest: number;
  botMessages: number;
  toolCalls: {
    total: number;
    success: number;
    failure: number;
    byTool: { toolName: string; count: number }[];
  };
  recentLogs: {
    id: string;
    toolName: string;
    ticketId: string;
    durationMs: number;
    success: boolean;
    createdAt: string;
  }[];
  runtimeDisabledByAdmin: boolean;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AiSupportClient({ data }: { data: AiSupportDashboardData }) {
  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "success" | "failure">("all");

  const helpfulRate =
    data.feedback.total > 0 ? Math.round((data.feedback.helpful / data.feedback.total) * 100) : null;

  const toolSuccessRate =
    data.toolCalls.total > 0 ? Math.round((data.toolCalls.success / data.toolCalls.total) * 100) : null;

  const filteredLogs = useMemo(() => {
    let result = data.recentLogs;
    if (logFilter === "success") result = result.filter((r) => r.success);
    else if (logFilter === "failure") result = result.filter((r) => !r.success);
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      result = result.filter(
        (r) => r.toolName.toLowerCase().includes(q) || r.ticketId.toLowerCase().includes(q),
      );
    }
    return result;
  }, [data.recentLogs, logFilter, logSearch]);

  const maxToolCount = Math.max(...data.toolCalls.byTool.map((t) => t.count), 1);

  return (
    <div className="min-h-full bg-gradient-to-b from-fuchsia-50/50 via-background to-background dark:from-fuchsia-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-fuchsia-600 via-purple-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Bot className="h-3.5 w-3.5" />
                AI assistant operations
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI support</h1>
              <p className="max-w-2xl text-sm text-white/80">
                Operational view of the in-app assistant: feedback, tool usage, and runtime toggle. Groq and{" "}
                <code className="rounded bg-white/10 px-1 text-xs">AI_SUPPORT_ENABLED</code> must be set on the backend;
                this panel controls the extra runtime switch in{" "}
                <code className="rounded bg-white/10 px-1 text-xs">system_configs.ai_support_enabled</code>.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Helpful", value: data.feedback.helpful, icon: ThumbsUp },
                { label: "Not helpful", value: data.feedback.notHelpful, icon: ThumbsDown },
                { label: "Helpful rate", value: helpfulRate != null ? `${helpfulRate}%` : "—", icon: Sparkles },
                { label: "Escalations", value: data.escalationsWithHumanRequest, icon: UserRound },
                { label: "Bot messages", value: data.botMessages, icon: MessageSquare },
                { label: "Tool calls", value: data.toolCalls.total, icon: Wrench },
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

        {/* Runtime toggle */}
        <Card className="border-fuchsia-100/60 dark:border-fuchsia-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cpu className="h-5 w-5 text-fuchsia-600" />
              Runtime toggle
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              When disabled, the API keeps AI off even if environment variables would allow it.
            </p>
          </CardHeader>
          <CardContent>
            <AiSupportRuntimeToggle initialRuntimeAllowsAi={!data.runtimeDisabledByAdmin} />
          </CardContent>
        </Card>

        {/* Tool calls summary */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5 text-fuchsia-600" />
                Tool calls (last {data.periodDays} days)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Since {formatDate(data.since)} — {data.toolCalls.total} total
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  {data.toolCalls.success} ok
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  {data.toolCalls.failure} failed
                </Badge>
                {toolSuccessRate != null && (
                  <Badge variant="secondary">{toolSuccessRate}% success rate</Badge>
                )}
              </div>
              {data.toolCalls.byTool.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tool calls in this period.</p>
              ) : (
                <div className="space-y-3">
                  {data.toolCalls.byTool.map((t) => (
                    <div key={t.toolName} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono font-medium">{t.toolName}</span>
                        <span className="tabular-nums text-muted-foreground">{t.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-fuchsia-500/80"
                          style={{ width: `${(t.count / maxToolCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Feedback breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-center">
                  <ThumbsUp className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
                  <p className="text-2xl font-bold tabular-nums">{data.feedback.helpful}</p>
                  <p className="text-xs text-muted-foreground">Helpful</p>
                </div>
                <div className="rounded-xl border bg-red-50/50 dark:bg-red-950/20 p-4 text-center">
                  <ThumbsDown className="h-6 w-6 mx-auto text-red-600 mb-2" />
                  <p className="text-2xl font-bold tabular-nums">{data.feedback.notHelpful}</p>
                  <p className="text-xs text-muted-foreground">Not helpful</p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Human escalation flags:</span>{" "}
                  <strong>{data.escalationsWithHumanRequest}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Bot messages sent:</span>{" "}
                  <strong>{data.botMessages}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent logs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent tool logs</CardTitle>
            <p className="text-sm text-muted-foreground">Latest entries from ai_support_tool_logs</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tool or ticket ID…"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {(["all", "success", "failure"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setLogFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      logFilter === f
                        ? "bg-fuchsia-600 text-white"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {f === "all" ? "All" : f === "success" ? "Success" : "Failed"}
                  </button>
                ))}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Bot className="h-10 w-10 opacity-40" />
                <p>No tool logs match your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Time</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {row.toolName}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[140px] truncate">
                          {row.ticketId}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">{row.durationMs} ms</TableCell>
                        <TableCell>
                          {row.success ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
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
