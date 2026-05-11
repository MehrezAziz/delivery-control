import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canProcessFiatWithdrawals } from "@/lib/staff-withdrawal-access";
import { notifyUserFiatPayoutSent } from "@/lib/notify-fiat-payout-sent";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ requestId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!canProcessFiatWithdrawals(auth)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    const { requestId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json({ error: "confirm must be true" }, { status: 400 });
    }

    type NotifyPayload = {
      userId: string;
      amount: string;
      currency: string;
      payoutMethod: "CASH" | "BANK_TRANSFER";
      withdrawalRequestId: string;
    };

    const notify = await prisma.$transaction(async (tx): Promise<NotifyPayload | null> => {
      const wr = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
        include: { wallet: { include: { customer: true } } },
      });
      if (!wr || wr.status !== "PENDING") {
        throw new Error("Request not found or already processed");
      }
      const amt = Number(wr.amount);
      const bal = Number(wr.wallet.balance);
      if (amt > bal) {
        throw new Error("Insufficient wallet balance to complete this withdrawal");
      }
      const nextBal = Math.round((bal - amt) * 100) / 100;
      await tx.digitalWallet.update({
        where: { id: wr.walletId },
        data: { balance: nextBal },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wr.walletId,
          type: "WITHDRAWAL_APPROVED",
          amount: -amt,
          status: "SUCCESS",
          referenceId: wr.id,
          referenceType: "WITHDRAWAL",
          balanceAfter: nextBal,
        },
      });
      await tx.withdrawalRequest.update({
        where: { id: wr.id },
        data: {
          status: "ACCEPTED",
          processedAt: new Date(),
          descriptionOfAdmin:
            typeof body?.adminNote === "string" && body.adminNote.trim()
              ? body.adminNote.trim().slice(0, 2000)
              : "Money sent (manual payout)",
        },
      });
      const customerUserId = wr.wallet.customer?.userId;
      if (!customerUserId) return null;
      return {
        userId: customerUserId,
        amount: amt.toFixed(2),
        currency: wr.wallet.currency,
        payoutMethod: wr.payoutMethod === "CASH" ? "CASH" : "BANK_TRANSFER",
        withdrawalRequestId: wr.id,
      };
    });

    if (notify) {
      void notifyUserFiatPayoutSent({
        ...notify,
        relatedEntityType: "WithdrawalRequest",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: e?.message || "Failed" }, { status: code });
  }
}
