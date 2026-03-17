import { prisma } from "./prisma";

export async function logAction(params: {
  actorId: string;
  actorRole: "ADMIN" | "CUSTOMER_SERVICE";
  actionType: string;
  targetType: string;
  targetId: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
}) {
  // Verify actor exists before creating log to avoid FK constraint errors
  const actor = await prisma.superUser.findUnique({ where: { id: params.actorId } });
  if (!actor) {
    console.error(`logAction: SuperUser ${params.actorId} not found — skipping log`);
    return;
  }
  await prisma.actionLog.create({ data: params });
}
