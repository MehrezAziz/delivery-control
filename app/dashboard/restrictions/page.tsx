import { prisma } from "@/lib/prisma";
import RestrictionsClient from "./restrictions-client";

export const dynamic = "force-dynamic";

export default async function RestrictionsPage() {
  const restrictions = await prisma.userRestriction.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = restrictions.map((r) => ({
    id: r.id,
    type: r.type,
    reason: r.reason,
    imposedBy: r.imposedBy,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    liftedAt: r.liftedAt?.toISOString() ?? null,
    user: {
      id: r.user.id,
      firstName: r.user.firstName,
      secondName: r.user.secondName,
      phone: r.user.phone,
      role: r.user.role,
    },
  }));

  const active = serialized.filter((r) => !r.liftedAt).length;
  const lifted = serialized.filter((r) => r.liftedAt).length;
  const permanent = serialized.filter((r) => !r.endDate && !r.liftedAt).length;
  const byType = {
    suspension: serialized.filter((r) => r.type === "SUSPENSION" && !r.liftedAt).length,
    block: serialized.filter((r) => r.type === "BLOCK" && !r.liftedAt).length,
    warning: serialized.filter((r) => r.type === "WARNING" && !r.liftedAt).length,
  };

  return (
    <RestrictionsClient
      restrictions={serialized}
      stats={{
        total: serialized.length,
        active,
        lifted,
        permanent,
        ...byType,
      }}
    />
  );
}
