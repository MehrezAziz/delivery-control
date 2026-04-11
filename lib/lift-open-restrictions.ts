import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Sets liftedAt on every open restriction for the given user id(s).
 * Uses findMany + update by id so rows are always updated (avoids updateMany matching 0 rows on user_id quirks).
 */
export async function liftAllOpenRestrictionsForUserIds(
  db: Tx,
  userIds: string[],
  now: Date,
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  const open = await db.userRestriction.findMany({
    where: {
      userId: { in: unique },
      liftedAt: null,
    },
    select: { id: true },
  });

  for (const row of open) {
    await db.userRestriction.update({
      where: { id: row.id },
      data: { liftedAt: now },
    });
  }
}
