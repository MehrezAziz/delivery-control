import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  GameCoinCreditMode,
  GamePrizeType,
  GameWinnerStatus,
  Prisma,
  ReferenceType,
  UserRole,
  WalletTransactionType,
  DriverTransactionType,
} from "@prisma/client";

export async function hashGameCode(code: string) {
  return bcrypt.hash(code, 10);
}

export function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function creditGamePrize(
  userId: string,
  role: UserRole,
  amount: number,
  winnerId: string,
) {
  if (amount <= 0) return;
  if (role === UserRole.CUSTOMER) {
    const wallet = await prisma.digitalWallet.findFirst({
      where: { customer: { userId } },
    });
    if (!wallet) return;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.digitalWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.GAME_PRIZE,
          amount,
          status: "SUCCESS",
          referenceId: winnerId,
          referenceType: ReferenceType.GAME_PRIZE,
          balanceAfter: updated.balance,
        },
      });
    });
  } else {
    const account = await prisma.driverAccount.findFirst({
      where: { driver: { userId } },
    });
    if (!account) return;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.driverAccount.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });
      await tx.driverTransaction.create({
        data: {
          accountId: account.id,
          type: DriverTransactionType.GAME_PRIZE,
          amount,
          referenceId: winnerId,
          referenceType: "GAME_PRIZE",
          balanceAfter: updated.balance,
        },
      });
    });
  }
}

export async function finalizeDrawWinners(drawId: string) {
  const draw = await prisma.gameDraw.findUnique({
    where: { id: drawId },
    include: {
      game: { include: { prizeTiers: true } },
      winners: { include: { prizeTier: true } },
    },
  });
  if (!draw) return;

  for (const w of draw.winners) {
    if (w.status !== GameWinnerStatus.CONFIRMED && w.status !== GameWinnerStatus.PENDING_CONFIRM) {
      continue;
    }
    const status =
      w.status === GameWinnerStatus.PENDING_CONFIRM
        ? GameWinnerStatus.CONFIRMED
        : w.status;
    if (w.status === GameWinnerStatus.PENDING_CONFIRM) {
      await prisma.gameWinner.update({
        where: { id: w.id },
        data: { status: GameWinnerStatus.CONFIRMED, confirmedAt: new Date() },
      });
    }
    if (
      w.prizeTier.prizeType === GamePrizeType.COINS &&
      draw.game.coinCreditMode === GameCoinCreditMode.AUTO_ON_CONFIRM &&
      status === GameWinnerStatus.CONFIRMED
    ) {
      await creditGamePrize(
        w.userId,
        w.userRole,
        Number(w.prizeTier.coinAmount ?? 0),
        w.id,
      );
      await prisma.gameWinner.update({
        where: { id: w.id },
        data: { status: GameWinnerStatus.PRIZE_CREDITED, creditedAt: new Date() },
      });
    }
  }

  await prisma.gameDraw.update({
    where: { id: drawId },
    data: { status: "CONFIRMED", closedAt: new Date() },
  });
}

export function serializeGame<T extends { prizeTiers?: { coinAmount: unknown }[] }>(g: T) {
  return {
    ...g,
    prizeTiers: g.prizeTiers?.map((t) => ({
      ...t,
      coinAmount: t.coinAmount != null ? Number(t.coinAmount) : null,
    })),
  };
}
