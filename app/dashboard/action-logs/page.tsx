import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ActionLogsPage() {
  const logs = await prisma.actionLog.findMany({
    include: { superUser: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Action Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail ({logs.length} latest)</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No action logs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Old → New</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{log.createdAt.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{log.superUser.pseudo}</TableCell>
                      <TableCell><Badge variant={log.actorRole === "ADMIN" ? "default" : "secondary"}>{log.actorRole}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{log.actionType}</TableCell>
                      <TableCell className="text-xs">
                        <span className="text-muted-foreground">{log.targetType}</span>
                        <br />
                        <span className="font-mono">{log.targetId.slice(0, 8)}...</span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {log.oldValue && <span className="text-red-500 line-through">{log.oldValue.length > 50 ? log.oldValue.slice(0, 50) + "..." : log.oldValue}</span>}
                        {log.oldValue && log.newValue && " → "}
                        {log.newValue && <span className="text-green-600">{log.newValue.length > 50 ? log.newValue.slice(0, 50) + "..." : log.newValue}</span>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{log.reason || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
