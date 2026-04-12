import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadAiSupportDashboard } from "@/lib/ai-support-dashboard";
import { AiSupportRuntimeToggle } from "./ai-support-runtime-toggle";

export const dynamic = "force-dynamic";

export default async function AiSupportPage() {
  const data = await loadAiSupportDashboard(prisma, 30);
  const runtimeAllowsAi = !data.runtimeDisabledByAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Support</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Operational view of the in-app assistant: feedback, tool usage, and runtime toggle (same database as the API).
          Groq and <code className="text-xs">AI_SUPPORT_ENABLED</code> must be set on the backend server; this panel
          controls the extra runtime switch stored in <code className="text-xs">system_configs.ai_support_enabled</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runtime toggle</CardTitle>
          <CardDescription>
            When unchecked, the API keeps AI off even if environment variables would allow it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiSupportRuntimeToggle initialRuntimeAllowsAi={runtimeAllowsAi} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Helpful feedback</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.feedback.helpful}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Not helpful</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.feedback.notHelpful}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Human escalation flags</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.escalationsWithHumanRequest}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bot messages (period)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.botMessages}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tool calls (last {data.periodDays} days)</CardTitle>
          <CardDescription>
            Since {data.since} — {data.toolCalls.total} total ({data.toolCalls.success} ok / {data.toolCalls.failure}{" "}
            failed)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.toolCalls.byTool.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tool calls in this period.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm">
              {data.toolCalls.byTool.map((t) => (
                <li key={t.toolName}>
                  <span className="font-mono">{t.toolName}</span> — {t.count}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent tool logs</CardTitle>
          <CardDescription>Latest entries from ai_support_tool_logs</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No logs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>ms</TableHead>
                  <TableHead>OK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLogs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.toolName}</TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-xs">{row.ticketId}</TableCell>
                    <TableCell>{row.durationMs}</TableCell>
                    <TableCell>{row.success ? "yes" : "no"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
