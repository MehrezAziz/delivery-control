import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { heroBackLinkClass } from "@/lib/hero-link-classes";
import { cn } from "@/lib/utils";
import DriverApprovalForm from "./driver-approval-form";
import DriverDocumentsViewer from "./driver-documents-viewer";
import DriverVerificationHistoryViewer from "@/components/driver-verification-history-viewer";
import DriverActionTimeline from "@/components/driver-action-timeline";
import { ArrowLeft, Truck, Phone, FileText, Ban, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function driverStatusClass(status: string) {
  if (status === "VERIFIED") return "bg-emerald-500/20 text-emerald-100 border-emerald-400/30";
  if (status === "PENDING_REVIEW") return "bg-amber-500/20 text-amber-100 border-amber-400/30";
  if (status === "REJECTED" || status === "SUSPENDED") return "bg-red-500/20 text-red-100 border-red-400/30";
  return "bg-white/15 text-white border-white/20";
}

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
  const activeRestrictions = driver.user.userRestrictions.filter((r) => !r.liftedAt).length;

  return (
    <div className="min-h-full bg-gradient-to-b from-sky-50/50 via-background to-background dark:from-sky-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-600 via-blue-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative p-6 sm:p-8 space-y-4">
            <Link href="/dashboard/drivers" className={heroBackLinkClass}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to drivers
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Truck className="h-3.5 w-3.5" />
                  Driver review
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {driver.user.firstName} {driver.user.secondName}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn("border", driverStatusClass(driver.status))}>
                    {driver.status.replace(/_/g, " ")}
                  </Badge>
                  {driver.vehicleType && (
                    <Badge className="bg-white/10 text-white/95 border-white/15">{driver.vehicleType}</Badge>
                  )}
                  {hasVerification && (
                    <Badge className="bg-white/10 text-white/95 border-white/15">
                      <FileText className="h-3 w-3 mr-1" />
                      {latestVerification!.documentType}
                    </Badge>
                  )}
                </div>
              </div>
              {driver.user.phone && (
                <div className="flex items-center gap-2 text-sky-100 text-sm">
                  <Phone className="h-4 w-4" />
                  {driver.user.phone}
                </div>
              )}
            </div>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-3 divide-x divide-white/15">
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-sky-200">Documents</p>
              <p className="text-lg font-bold">{hasVerification ? "Yes" : "No"}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-sky-200">Restrictions</p>
              <p className="text-lg font-bold tabular-nums">{activeRestrictions}</p>
            </div>
            <div className="px-4 py-3 text-center col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-sky-200">Submitted</p>
              <p className="text-sm font-semibold mt-0.5">
                {latestVerification?.submittedAt?.toLocaleDateString() || "—"}
              </p>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border-sky-200/50 dark:border-sky-800/30">
          <div className="h-0.5 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              Driver information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Full name", value: `${driver.user.firstName} ${driver.user.secondName}` },
                { label: "Phone", value: driver.user.phone || "—" },
                { label: "Vehicle", value: driver.vehicleType || "—" },
                { label: "Status", value: driver.status.replace(/_/g, " ") },
                { label: "Document type", value: hasVerification ? latestVerification!.documentType : "—" },
                { label: "Submitted", value: latestVerification?.submittedAt?.toLocaleDateString() || "—" },
              ].map((row) => (
                <div key={row.label} className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
                  <p className="text-sm font-medium">{row.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <DriverDocumentsViewer driverId={driver.id} hasVerification={hasVerification} />
        <DriverVerificationHistoryViewer driverId={driver.id} />
        <DriverActionTimeline driverId={driver.id} />

        {driver.user.userRestrictions.length > 0 && (
          <Card className="overflow-hidden border-red-200/40 dark:border-red-800/30">
            <div className="h-0.5 bg-gradient-to-r from-red-500 to-rose-500" />
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-600" />
                Restriction history
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {driver.user.userRestrictions.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-xl border p-4",
                      !r.liftedAt && "border-red-200 bg-red-50/50 dark:bg-red-950/20",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={r.liftedAt ? "secondary" : "destructive"}>{r.type}</Badge>
                      {r.liftedAt && <span className="text-xs text-muted-foreground">(Lifted)</span>}
                    </div>
                    <p className="text-sm mt-2">{r.reason}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {r.startDate.toLocaleDateString()} — {r.endDate?.toLocaleDateString() || "Permanent"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-sky-200/50 dark:border-sky-800/30">
          <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader>
            <CardTitle className="text-base">Approval actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <DriverApprovalForm
              driverId={driver.id}
              userId={driver.user.id}
              currentStatus={driver.status}
              hasDocuments={hasVerification}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
