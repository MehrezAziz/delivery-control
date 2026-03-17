import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import DriverApprovalForm from "./driver-approval-form";
import DriverDocumentsViewer from "./driver-documents-viewer";

export const dynamic = "force-dynamic";

export default async function DriverReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      user: { include: { userRestrictions: { orderBy: { createdAt: "desc" }, take: 5 } } },
      driverVerifications: {
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!driver) notFound();
  const latestVerification = driver.driverVerifications[0] ?? null;
  const hasVerification = !!latestVerification;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        
        <h1 className="text-2xl font-semibold">Driver Review</h1>
        <Link href="/dashboard/drivers">
          <Button variant="outline" size="sm">← Go back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Driver Info</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><span className="text-sm text-muted-foreground">Name:</span> <span className="ml-2">{driver.user.firstName} {driver.user.secondName}</span></div>
          <div><span className="text-sm text-muted-foreground">Phone:</span> <span className="ml-2">{driver.user.phone || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Vehicle:</span> <span className="ml-2">{driver.vehicleType || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Status:</span> <Badge className="ml-2">{driver.status}</Badge></div>
          {hasVerification && (
            <div><span className="text-sm text-muted-foreground">Document Type:</span> <Badge className="ml-2" variant="outline">{latestVerification!.documentType}</Badge></div>
          )}
          {hasVerification && latestVerification!.submittedAt && (
            <div><span className="text-sm text-muted-foreground">Submitted:</span> <span className="ml-2">{latestVerification!.submittedAt.toLocaleDateString()}</span></div>
          )}
        </CardContent>
      </Card>

      {/* Documents: loaded on demand via client component */}
      <DriverDocumentsViewer driverId={driver.id} hasVerification={hasVerification} />

      {/* Restriction history */}
      {driver.user.userRestrictions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Restriction History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {driver.user.userRestrictions.map(r => (
                <div key={r.id} className="border rounded p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.liftedAt ? "secondary" : "destructive"}>{r.type}</Badge>
                    {r.liftedAt && <span className="text-xs text-muted-foreground">(Lifted)</span>}
                  </div>
                  <p className="text-sm mt-1">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.startDate.toLocaleDateString()} - {r.endDate?.toLocaleDateString() || "Permanent"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />
      <DriverApprovalForm driverId={driver.id} userId={driver.user.id} currentStatus={driver.status} hasDocuments={hasVerification} />
    </div>
  );
}
