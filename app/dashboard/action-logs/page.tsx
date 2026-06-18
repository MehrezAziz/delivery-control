import { prisma } from "@/lib/prisma";
import ActionLogsClient from "./action-logs-client";

export const dynamic = "force-dynamic";

export default async function ActionLogsPage() {
  const logs = await prisma.actionLog.findMany({
    include: { superUser: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const serialized = logs.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    actorRole: log.actorRole,
    actionType: log.actionType,
    targetType: log.targetType,
    targetId: log.targetId,
    oldValue: log.oldValue,
    newValue: log.newValue,
    reason: log.reason,
    createdAt: log.createdAt.toISOString(),
    actorPseudo: log.superUser.pseudo,
  }));

  const adminCount = serialized.filter((l) => l.actorRole === "ADMIN").length;
  const csCount = serialized.filter((l) => l.actorRole === "CUSTOMER_SERVICE").length;
  const withChanges = serialized.filter((l) => l.oldValue || l.newValue).length;
  const actors = new Set(serialized.map((l) => l.actorId)).size;

  return (
    <ActionLogsClient
      logs={serialized}
      stats={{
        total: serialized.length,
        adminCount,
        csCount,
        withChanges,
        actors,
      }}
    />
  );
}
