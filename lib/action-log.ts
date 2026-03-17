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
  await prisma.actionLog.create({ data: params });
}
