import { prisma } from "@/lib/prisma";
import { DriversApprovalClient } from "./drivers-approval-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  recommendation?: string;
  sort?: string;
}>;

const ALLOWED_STATUSES = ["PENDING_REVIEW", "INCOMPLETE", "REJECTED", "VERIFIED"] as const;

function getRecommendation(driver: {
  driverVerifications: Array<{
    documents: Array<{ mlAnalysis: unknown }>;
  }>;
}) {
  const docs = driver.driverVerifications[0]?.documents ?? [];
  const latestDoc =
    docs.find((d) => {
      const ml = d.mlAnalysis as Record<string, unknown> | null;
      return ml?.stage === "ML_ANALYSIS_COMPLETE";
    }) ?? docs[0];
  const ml = latestDoc?.mlAnalysis as Record<string, unknown> | null;
  return (
    (typeof ml?.recommendation === "string" ? ml.recommendation : undefined) ||
    (typeof ml?.decision === "string" ? ml.decision : undefined) ||
    "UNKNOWN"
  );
}

export default async function DriversApprovalPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const statusFilter = params.status || "PENDING_REVIEW";
  const recommendationFilter = params.recommendation || "ALL";
  const sort = params.sort || "newest";

  const normalizedStatus = ALLOWED_STATUSES.includes(statusFilter as (typeof ALLOWED_STATUSES)[number])
    ? (statusFilter as (typeof ALLOWED_STATUSES)[number])
    : "PENDING_REVIEW";

  const [pendingDrivers, statusCounts] = await Promise.all([
    prisma.driver.findMany({
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
          include: { documents: true },
        },
      },
      orderBy: { user: { createdAt: sort === "oldest" ? "asc" : "desc" } },
    }),
    prisma.driver.groupBy({
      by: ["status"],
      where: { status: { in: ["PENDING_REVIEW", "INCOMPLETE", "REJECTED", "VERIFIED"] } },
      _count: { _all: true },
    }),
  ]);

  const filtered = pendingDrivers.filter((driver) => {
    if (recommendationFilter === "ALL") return true;
    return getRecommendation(driver) === recommendationFilter;
  });

  const countMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

  const rows = filtered.map((d) => ({
    id: d.id,
    firstName: d.user.firstName ?? "",
    secondName: d.user.secondName ?? "",
    phone: d.user.phone,
    vehicleType: d.vehicleType,
    status: d.status,
    documentType: d.driverVerifications[0]?.documentType ?? null,
    recommendation: getRecommendation(d),
    submittedAt: d.driverVerifications[0]?.submittedAt?.toISOString() ?? null,
  }));

  return (
    <DriversApprovalClient
      drivers={rows}
      filters={{ status: statusFilter, recommendation: recommendationFilter, sort }}
      stats={{
        pending: countMap.PENDING_REVIEW ?? 0,
        incomplete: countMap.INCOMPLETE ?? 0,
        rejected: countMap.REJECTED ?? 0,
        verified: countMap.VERIFIED ?? 0,
      }}
    />
  );
}
