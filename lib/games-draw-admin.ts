import {
  Game,
  GameCoinCreditMode,
  GameDrawStatus,
  GamePrizeType,
  GameWinnerSelectionMode,
  GameWinnerStatus,
  GameWinnerPoolMode,
  GamePhysicalPrizeStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { creditGamePrize } from "@/lib/games-admin";
import { getCurrentPeriod, getPreviousPeriod, GamePeriodBounds } from "@/lib/games-period";

type EligibleUser = { userId: string; userRole: UserRole; weight: number };

function roleMatchesPool(userRole: UserRole, poolScope: string): boolean {
  if (poolScope === "COMBINED") return true;
  if (poolScope === "CUSTOMER") return userRole === UserRole.CUSTOMER;
  if (poolScope === "DRIVER") return userRole === UserRole.DRIVER;
  return true;
}

function weightedPick(pool: EligibleUser[]): EligibleUser | null {
  if (pool.length === 0) return null;
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

async function getEligibleParticipants(
  game: Game,
  periodStart: Date,
  periodEnd: Date,
  poolScope: string,
): Promise<EligibleUser[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentWinners = await prisma.gameWinner.findMany({
    where: {
      gameId: game.id,
      wonAt: { gte: sixMonthsAgo },
      status: {
        in: [
          GameWinnerStatus.CONFIRMED,
          GameWinnerStatus.PRIZE_CREDITED,
          GameWinnerStatus.PENDING_CONFIRM,
        ],
      },
    },
    select: { userId: true },
  });
  const blocked = new Set(recentWinners.map((w) => w.userId));

  const allAnswers = await prisma.gameAnswer.groupBy({
    by: ["userId"],
    where: {
      gameId: game.id,
      answeredAt: { gte: periodStart, lt: periodEnd },
    },
    _count: { _all: true },
  });

  const correctAnswers = await prisma.gameAnswer.groupBy({
    by: ["userId"],
    where: {
      gameId: game.id,
      isCorrect: true,
      answeredAt: { gte: periodStart, lt: periodEnd },
    },
    _count: { _all: true },
  });
  const correctByUser = new Map(correctAnswers.map((row) => [row.userId, row._count._all]));
  const soleParticipant = allAnswers.length === 1 ? allAnswers[0].userId : null;

  const result: EligibleUser[] = [];
  for (const row of allAnswers) {
    if (blocked.has(row.userId)) continue;

    let weight = correctByUser.get(row.userId) ?? 0;
    if (weight === 0 && row.userId === soleParticipant) {
      weight = 1;
    }
    if (weight === 0) continue;

    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      include: {
        customer: true,
        driver: { include: { driverAccount: true } },
      },
    });
    if (!user) continue;

    if (game.requireCompletedOrder) {
      if (user.role === UserRole.CUSTOMER) {
        if (!user.customer || user.customer.completedOrders < 1) continue;
      } else if (user.role === UserRole.DRIVER) {
        if (!user.driver?.driverAccount || user.driver.driverAccount.completedDeliveries < 1) {
          continue;
        }
      }
    }

    if (!roleMatchesPool(user.role, poolScope)) continue;
    result.push({ userId: user.id, userRole: user.role, weight });
  }
  return result;
}

async function finalizeDrawWinners(
  drawId: string,
  game: Game & { prizeTiers: { prizeType: GamePrizeType; coinAmount: unknown }[] },
) {
  const winners = await prisma.gameWinner.findMany({
    where: { drawId, status: GameWinnerStatus.CONFIRMED },
    include: { prizeTier: true },
  });

  for (const w of winners) {
    if (
      w.prizeTier.prizeType === GamePrizeType.COINS &&
      game.coinCreditMode === GameCoinCreditMode.AUTO_ON_CONFIRM
    ) {
      await creditGamePrize(w.userId, w.userRole, Number(w.prizeTier.coinAmount ?? 0), w.id);
      await prisma.gameWinner.update({
        where: { id: w.id },
        data: { status: GameWinnerStatus.PRIZE_CREDITED, creditedAt: new Date() },
      });
    }
  }
}

async function runDrawForScope(
  game: Game & {
    prizeTiers: { id: string; rank: number; prizeType: GamePrizeType; coinAmount: unknown }[];
  },
  drawId: string,
  period: GamePeriodBounds,
  poolScope: string,
) {
  const eligible = await getEligibleParticipants(
    game,
    period.periodStart,
    period.periodEnd,
    poolScope,
  );
  if (eligible.length === 0) {
    await prisma.gameDraw.update({
      where: { id: drawId },
      data: { status: GameDrawStatus.CONFIRMED, closedAt: new Date() },
    });
    return { winnersCreated: 0, eligibleCount: 0 };
  }

  const tiers = game.prizeTiers;
  if (tiers.length === 0) {
    return { winnersCreated: 0, eligibleCount: eligible.length, error: "No prize tiers configured" };
  }

  const picks: EligibleUser[] = [];
  const pool = [...eligible];
  for (const _tier of tiers) {
    const pick = weightedPick(pool);
    if (!pick) break;
    picks.push(pick);
    pool.splice(
      pool.findIndex((p) => p.userId === pick.userId),
      1,
    );
  }

  const confirmDeadline =
    game.winnerSelectionMode === GameWinnerSelectionMode.RANDOM_CONFIRM
      ? new Date(Date.now() + 12 * 60 * 60 * 1000)
      : null;

  const status =
    game.winnerSelectionMode === GameWinnerSelectionMode.MANUAL
      ? GameDrawStatus.AWAITING_CONFIRM
      : game.winnerSelectionMode === GameWinnerSelectionMode.RANDOM_CONFIRM
        ? GameDrawStatus.AWAITING_CONFIRM
        : GameDrawStatus.CONFIRMED;

  await prisma.$transaction(async (tx) => {
    await tx.gameDraw.update({
      where: { id: drawId },
      data: { status, confirmDeadline, closedAt: new Date() },
    });

    for (let i = 0; i < picks.length; i++) {
      const pick = picks[i];
      const tier = tiers[i];
      if (!tier) break;
      const winnerStatus =
        status === GameDrawStatus.CONFIRMED
          ? GameWinnerStatus.CONFIRMED
          : GameWinnerStatus.PENDING_CONFIRM;

      await tx.gameWinner.create({
        data: {
          gameId: game.id,
          drawId,
          userId: pick.userId,
          userRole: pick.userRole,
          prizeTierId: tier.id,
          status: winnerStatus,
          correctCountInPeriod: pick.weight,
          physicalPrizeStatus:
            tier.prizeType === GamePrizeType.PHYSICAL
              ? GamePhysicalPrizeStatus.PENDING_CONTACT
              : null,
          confirmedAt: winnerStatus === GameWinnerStatus.CONFIRMED ? new Date() : null,
        },
      });
    }
  });

  if (status === GameDrawStatus.CONFIRMED) {
    await finalizeDrawWinners(drawId, game);
  }

  return { winnersCreated: picks.length, eligibleCount: eligible.length };
}

/** Run any due draws for a single game (mirrors backend cron logic). */
export async function runDueDrawsForGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { prizeTiers: { orderBy: { rank: "asc" } } },
  });
  if (!game) throw new Error("Game not found");

  const now = new Date();
  const periods = new Map<string, GamePeriodBounds>();
  const prev = getPreviousPeriod(game, now);
  periods.set(prev.periodKey, prev);

  if (game.endsAt && game.endsAt.getTime() <= now.getTime()) {
    const current = getCurrentPeriod(game, now);
    periods.set(current.periodKey, current);
  }

  const scopes =
    game.winnerPoolMode === GameWinnerPoolMode.SEPARATE_BY_ROLE
      ? ["CUSTOMER", "DRIVER"]
      : ["COMBINED"];

  const results: Array<{
    poolScope: string;
    periodKey: string;
    winnersCreated: number;
    eligibleCount: number;
    error?: string;
  }> = [];

  for (const period of periods.values()) {
    const periodEnded = period.periodEnd.getTime() <= now.getTime();
    const current = getCurrentPeriod(game, now);
    const forceEarlyClose =
      !!game.endsAt && game.endsAt.getTime() <= now.getTime() && period.periodKey === current.periodKey;
    if (!periodEnded && !forceEarlyClose) continue;

    for (const poolScope of scopes) {
      let draw = await prisma.gameDraw.findFirst({
        where: {
          gameId: game.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          poolScope,
        },
      });
      if (!draw) {
        draw = await prisma.gameDraw.create({
          data: {
            gameId: game.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            poolScope,
            status: GameDrawStatus.OPEN,
          },
        });
      }
      if (draw.status !== GameDrawStatus.OPEN) continue;

      const outcome = await runDrawForScope(game, draw.id, period, poolScope);
      results.push({ poolScope, periodKey: period.periodKey, ...outcome });
    }
  }

  return results;
}
