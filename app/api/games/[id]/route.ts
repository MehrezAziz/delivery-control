import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import { serializeGame } from "@/lib/games-admin";
import { getCurrentPeriodEnd } from "@/lib/games-period";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id } = await params;
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      countries: { include: { country: true } },
      prizeTiers: { orderBy: { rank: "asc" } },
      categories: { orderBy: { sortOrder: "asc" } },
      draws: { orderBy: { periodEnd: "desc" }, take: 20, include: { winners: true } },
      _count: {
        select: {
          questions: { where: { isActive: true } },
          accessGrants: true,
          answers: true,
        },
      },
    },
  });
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lowQuestionPool = game._count.questions < game.questionsPerDay;

  const playedRows = await prisma.gameAnswer.findMany({
    where: { gameId: id },
    distinct: ["userId"],
    select: { userId: true },
  });

  const nextDrawAt = getCurrentPeriodEnd(game);
  const endsAt = (game as { endsAt?: Date | null }).endsAt ?? null;
  const hasEnded = !!endsAt && endsAt.getTime() <= Date.now();

  return NextResponse.json({
    ...serializeGame(game),
    lowQuestionPool,
    participantsCount: game._count.accessGrants,
    playedCount: playedRows.length,
    answersCount: game._count.answers,
    nextDrawAt,
    endsAt,
    hasEnded,
    accessCodePlain: (game as unknown as { accessCodePlain: string | null }).accessCodePlain ?? null,
    previousAccessCodePlain:
      (game as unknown as { previousAccessCodePlain: string | null }).previousAccessCodePlain ?? null,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  if (body.countryIds) {
    await prisma.gameCountry.deleteMany({ where: { gameId: id } });
    await prisma.gameCountry.createMany({
      data: body.countryIds.map((countryId: string) => ({ gameId: id, countryId })),
    });
  }

  if (body.prizeTiers) {
    await prisma.gamePrizeTier.deleteMany({ where: { gameId: id } });
    await prisma.gamePrizeTier.createMany({
      data: body.prizeTiers.map(
        (t: {
          rank: number;
          prizeType: string;
          coinAmount?: number;
          prizeLabel?: string;
          prizeImageUrl?: string;
          congratsImageUrl?: string;
        }) => ({
          gameId: id,
          rank: t.rank,
          prizeType: t.prizeType,
          coinAmount: t.coinAmount ?? null,
          prizeLabel: t.prizeLabel ?? null,
          prizeImageUrl: t.prizeImageUrl ?? null,
          congratsImageUrl: t.congratsImageUrl ?? null,
        }),
      ),
    });
  }

  const game = await prisma.game.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.scheduleMode !== undefined ? { scheduleMode: body.scheduleMode } : {}),
      ...(body.calendarDays !== undefined ? { calendarDays: body.calendarDays } : {}),
      ...(body.weekdays !== undefined ? { weekdays: body.weekdays } : {}),
      ...(body.periodMode !== undefined ? { periodMode: body.periodMode } : {}),
      ...(body.customPeriodDays !== undefined ? { customPeriodDays: body.customPeriodDays } : {}),
      ...(body.customPeriodAnchor !== undefined ? { customPeriodAnchor: body.customPeriodAnchor } : {}),
      ...(body.questionsPerDay !== undefined ? { questionsPerDay: body.questionsPerDay } : {}),
      ...(body.requireCompletedOrder !== undefined
        ? { requireCompletedOrder: body.requireCompletedOrder }
        : {}),
      ...(body.winnerSelectionMode !== undefined
        ? { winnerSelectionMode: body.winnerSelectionMode }
        : {}),
      ...(body.coinCreditMode !== undefined ? { coinCreditMode: body.coinCreditMode } : {}),
      ...(body.winnerPoolMode !== undefined ? { winnerPoolMode: body.winnerPoolMode } : {}),
      ...(body.customerButtonPlacement !== undefined
        ? { customerButtonPlacement: body.customerButtonPlacement }
        : {}),
      ...(body.driverButtonPlacement !== undefined
        ? { driverButtonPlacement: body.driverButtonPlacement }
        : {}),
      ...(body.bannerImageUrls !== undefined ? { bannerImageUrls: body.bannerImageUrls } : {}),
      ...(body.showRecentWinners !== undefined ? { showRecentWinners: body.showRecentWinners } : {}),
      ...(body.endsAt !== undefined
        ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
        : {}),
    },
    include: {
      countries: { include: { country: true } },
      prizeTiers: { orderBy: { rank: "asc" } },
    },
  });

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "UPDATE_GAME",
    targetType: "GAME",
    targetId: id,
    newValue: JSON.stringify(body),
  });

  return NextResponse.json(serializeGame(game));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  const { id } = await params;
  await prisma.game.delete({ where: { id } });
  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "DELETE_GAME",
    targetType: "GAME",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
