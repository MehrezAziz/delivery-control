import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import {
  generateSixDigitCode,
  hashGameCode,
  serializeGame,
} from "@/lib/games-admin";

export async function GET() {
  await requireAdmin();
  const games = await prisma.game.findMany({
    include: {
      countries: { include: { country: true } },
      prizeTiers: { orderBy: { rank: "asc" } },
      _count: {
        select: {
          questions: true,
          answers: true,
          winners: true,
          accessGrants: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const gameIds = games.map((g) => g.id);
  const playedRows =
    gameIds.length > 0
      ? await prisma.gameAnswer.findMany({
          where: { gameId: { in: gameIds } },
          distinct: ["gameId", "userId"],
          select: { gameId: true },
        })
      : [];
  const playedByGame = new Map<string, number>();
  for (const r of playedRows) {
    playedByGame.set(r.gameId, (playedByGame.get(r.gameId) ?? 0) + 1);
  }

  return NextResponse.json(
    games.map((g) => ({
      ...serializeGame(g),
      participantsCount: g._count.accessGrants,
      playedCount: playedByGame.get(g.id) ?? 0,
    })),
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  const body = await req.json();
  const code = body.accessCode?.trim() || generateSixDigitCode();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Access code must be 6 digits" }, { status: 400 });
  }

  const game = await prisma.game.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      isActive: body.isActive ?? false,
      scheduleMode: body.scheduleMode ?? "ALL_DAYS",
      calendarDays: body.calendarDays ?? [],
      weekdays: body.weekdays ?? [],
      periodMode: body.periodMode ?? "DAILY",
      customPeriodDays: body.customPeriodDays ?? null,
      customPeriodAnchor: body.customPeriodAnchor ?? null,
      questionsPerDay: body.questionsPerDay ?? 5,
      accessCodeHash: await hashGameCode(code),
      accessCodePlain: code,
      requireCompletedOrder: body.requireCompletedOrder ?? false,
      winnerSelectionMode: body.winnerSelectionMode ?? "RANDOM",
      coinCreditMode: body.coinCreditMode ?? "AUTO_ON_CONFIRM",
      winnerPoolMode: body.winnerPoolMode ?? "COMBINED",
      customerButtonPlacement: body.customerButtonPlacement,
      driverButtonPlacement: body.driverButtonPlacement,
      bannerImageUrls: body.bannerImageUrls ?? [],
      showRecentWinners: body.showRecentWinners ?? true,
      countries: {
        create: (body.countryIds ?? []).map((countryId: string) => ({ countryId })),
      },
      prizeTiers: {
        create: (body.prizeTiers ?? []).map(
          (t: {
            rank: number;
            prizeType: string;
            coinAmount?: number;
            prizeLabel?: string;
            prizeImageUrl?: string;
            congratsImageUrl?: string;
          }) => ({
            rank: t.rank,
            prizeType: t.prizeType,
            coinAmount: t.coinAmount ?? null,
            prizeLabel: t.prizeLabel ?? null,
            prizeImageUrl: t.prizeImageUrl ?? null,
            congratsImageUrl: t.congratsImageUrl ?? null,
          }),
        ),
      },
    },
    include: {
      countries: { include: { country: true } },
      prizeTiers: { orderBy: { rank: "asc" } },
    },
  });

  await logAction({
    actorId: auth.superUserId,
    actorRole: "ADMIN",
    actionType: "CREATE_GAME",
    targetType: "GAME",
    targetId: game.id,
    newValue: JSON.stringify({ name: game.name }),
  });

  return NextResponse.json({
    ...serializeGame(game),
    accessCodePlain: code,
  });
}
