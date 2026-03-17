import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function RestrictionsPage() {
  const restrictions = await prisma.userRestriction.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">User Restrictions</h1>
      <Card>
        <CardHeader><CardTitle>All Restrictions ({restrictions.length})</CardTitle></CardHeader>
        <CardContent>
          {restrictions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No restrictions found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restrictions.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.user.firstName} {r.user.secondName}</TableCell>
                    <TableCell><Badge variant="destructive">{r.type}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell>{r.startDate.toLocaleDateString()}</TableCell>
                    <TableCell>{r.endDate?.toLocaleDateString() || "Permanent"}</TableCell>
                    <TableCell>
                      <Badge variant={r.liftedAt ? "secondary" : "default"}>
                        {r.liftedAt ? "Lifted" : "Active"}
                      </Badge>
                    </TableCell>
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
