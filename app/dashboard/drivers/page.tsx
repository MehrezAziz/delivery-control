import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DriversApprovalPage() {
  const pendingDrivers = await prisma.driver.findMany({
    where: { status: { in: ["PENDING_REVIEW", "INCOMPLETE"] } },
    include: {
      user: true,
      driverVerification: true, // Only check if verification exists, NOT documents
    },
    orderBy: { user: { createdAt: "desc" } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Driver Approval</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pending Drivers ({pendingDrivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingDrivers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending drivers.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDrivers.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>{d.user.firstName} {d.user.secondName}</TableCell>
                    <TableCell>{d.user.phone || "-"}</TableCell>
                    <TableCell>{d.vehicleType || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{d.status}</Badge></TableCell>
                    <TableCell>
                      {d.driverVerification ? (
                        <Badge variant="outline">{d.driverVerification.documentType}</Badge>
                      ) : <span className="text-muted-foreground text-sm">None</span>}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/drivers/${d.id}`}>
                        <Button variant="outline" size="sm">Review</Button>
                      </Link>
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
