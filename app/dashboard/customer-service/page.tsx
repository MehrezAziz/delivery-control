import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import CreateCSForm from "./create-cs-form";

export const dynamic = "force-dynamic";

export default async function CustomerServicePage() {
  const csUsers = await prisma.customerService.findMany({
    include: { superUser: true },
    orderBy: { superUser: { createdAt: "desc" } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Service Management</h1>

      <CreateCSForm />

      <Card>
        <CardHeader><CardTitle>Customer Service Accounts ({csUsers.length})</CardTitle></CardHeader>
        <CardContent>
          {csUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No customer service accounts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pseudo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csUsers.map(cs => (
                  <TableRow key={cs.id}>
                    <TableCell>{cs.superUser.pseudo}</TableCell>
                    <TableCell>{cs.superUser.email}</TableCell>
                    <TableCell>{cs.superUser.telephone}</TableCell>
                    <TableCell><Badge variant={cs.superUser.status === "ACTIVE" ? "default" : "secondary"}>{cs.superUser.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {cs.roles.map(r => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)}
                      </div>
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
