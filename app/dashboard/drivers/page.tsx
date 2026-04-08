import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  recommendation?: string;
  sort?: string;
}>;

export default async function DriversApprovalPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const statusFilter = params.status || "PENDING_REVIEW";
  const recommendationFilter = params.recommendation || "ALL";
  const sort = params.sort || "newest";

  const allowedStatuses = ["PENDING_REVIEW", "INCOMPLETE", "REJECTED", "VERIFIED"] as const;
  const normalizedStatus = allowedStatuses.includes(statusFilter as (typeof allowedStatuses)[number])
    ? (statusFilter as (typeof allowedStatuses)[number])
    : "PENDING_REVIEW";

  const pendingDrivers = await prisma.driver.findMany({
    where: {
      status:
        statusFilter === "ALL"
          ? { in: ["PENDING_REVIEW", "INCOMPLETE", "REJECTED", "VERIFIED"] }
          : normalizedStatus,
    },
    include: {
      user: true,
      driverVerifications: {
        orderBy: { submittedAt: "desc" as const },
        take: 1,
        include: {
          documents: true,
        },
      },
    },
    orderBy: { user: { createdAt: sort === "oldest" ? "asc" : "desc" } },
  });

  const filtered = pendingDrivers.filter((driver) => {
    if (recommendationFilter === "ALL") return true;
    const docs = driver.driverVerifications[0]?.documents ?? [];
    const latestDoc =
      docs.find((d) => {
        const ml = d.mlAnalysis as Record<string, unknown> | null;
        return ml?.stage === "ML_ANALYSIS_COMPLETE";
      }) ?? docs[0];
    const ml = latestDoc?.mlAnalysis as Record<string, unknown> | null;
    const recommendation =
      typeof ml?.recommendation === "string"
        ? ml.recommendation
        : typeof ml?.decision === "string"
          ? ml.decision
          : "UNKNOWN";
    return recommendation === recommendationFilter;
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Driver Approval</h1>
      <Card>
        <CardHeader>
          <CardTitle>Manual Review Queue ({filtered.length})</CardTitle>
          <form className="mt-3 grid gap-2 sm:grid-cols-4">
            <select name="status" defaultValue={statusFilter} className="border rounded px-2 py-1 text-sm">
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="REJECTED">Rejected</option>
              <option value="VERIFIED">Verified</option>
              <option value="ALL">All statuses</option>
            </select>
            <select name="recommendation" defaultValue={recommendationFilter} className="border rounded px-2 py-1 text-sm">
              <option value="ALL">All recommendations</option>
              <option value="APPROVED">Recommended approve</option>
              <option value="REVIEW">Needs review</option>
              <option value="REJECTED">Recommended reject</option>
              <option value="PENDING_STAFF_REVIEW">Pending staff review</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
            <select name="sort" defaultValue={sort} className="border rounded px-2 py-1 text-sm">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <Button type="submit" variant="outline" size="sm">Apply filters</Button>
          </form>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
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
                  <TableHead>AI Recommendation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => {
                  const docs = d.driverVerifications[0]?.documents ?? [];
                  const latestDoc =
                    docs.find((x) => {
                      const ml = x.mlAnalysis as Record<string, unknown> | null;
                      return ml?.stage === "ML_ANALYSIS_COMPLETE";
                    }) ?? docs[0];
                  const ml = latestDoc?.mlAnalysis as Record<string, unknown> | null;
                  const recommendation =
                    (typeof ml?.recommendation === "string" ? ml.recommendation : undefined) ||
                    (typeof ml?.decision === "string" ? ml.decision : undefined) ||
                    "UNKNOWN";
                  return (
                  <TableRow key={d.id}>
                    <TableCell>{d.user.firstName} {d.user.secondName}</TableCell>
                    <TableCell>{d.user.phone || "-"}</TableCell>
                    <TableCell>{d.vehicleType || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{d.status}</Badge></TableCell>
                    <TableCell>
                      {d.driverVerifications[0] ? (
                        <Badge variant="outline">{d.driverVerifications[0].documentType}</Badge>
                      ) : <span className="text-muted-foreground text-sm">None</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{recommendation}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/drivers/${d.id}`}>
                        <Button variant="outline" size="sm">Review</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
