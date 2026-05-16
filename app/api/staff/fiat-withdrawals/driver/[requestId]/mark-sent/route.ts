import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canProcessFiatWithdrawals } from "@/lib/staff-withdrawal-access";
import { notifyUserFiatPayoutSent } from "@/lib/notify-fiat-payout-sent";
import { logAction } from "@/lib/action-log";

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

    const adminNote =
      typeof body?.adminNote === "string" && body.adminNote.trim()
        ? body.adminNote.trim().slice(0, 2000)
        : "";

    type NotifyPayload = {
      userId: string;
      amount: string;
      currency: string;
      payoutMethod: "CASH" | "BANK_TRANSFER";
      withdrawalRequestId: string;
    };

    type TxResult = {
      notify: NotifyPayload | null;
      logMeta: {
        requestId: string;
        amount: number;
        grossDebit: number;
        currency: string;
        payoutMethod: "CASH" | "BANK_TRANSFER";
      };
    };

    const { notify, logMeta } = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const wr = await tx.driverWithdrawalRequest.findUnique({
        where: { id: requestId },
        include: { account: { include: { driver: true } } },
      });
      if (!wr || wr.status !== "PENDING") {
        throw new Error("Request not found or already processed");
      }
      const payoutMethod = wr.payoutMethod === "CASH" ? "CASH" : "BANK_TRANSFER";
      if (payoutMethod === "CASH" && !adminNote) {
        throw new Error("Internal note is required for cash payouts");
      }
      const grossDebit = Number(wr.amount);
      const fee = Number(wr.feeAmount ?? 0);
      const netPayout = Math.round((grossDebit - fee) * 100) / 100;
      const bal = Number(wr.account.balance);
      if (grossDebit > bal) {
        throw new Error("Insufficient driver balance to complete this withdrawal");
      }
      if (netPayout <= 0) {
        throw new Error("Invalid withdrawal: payout amount after fee is zero");
      }
      const nextBal = Math.round((bal - grossDebit) * 100) / 100;
      await tx.driverAccount.update({
        where: { id: wr.driverAccountId },
        data: { balance: nextBal },
      });
      await tx.driverTransaction.create({
        data: {
          accountId: wr.driverAccountId,
          type: "WITHDRAWAL",
          amount: -grossDebit,
          referenceId: wr.id,
          referenceType: "WITHDRAWAL",
          description: `Fiat payout completed (withdrawal request)`,
          balanceAfter: nextBal,
        },
      });
      await tx.driverWithdrawalRequest.update({
        where: { id: wr.id },
        data: {
          status: "ACCEPTED",
          processedAt: new Date(),
          descriptionFromStaff: adminNote || "Money sent (manual payout)",
        },
      });
      const driverUserId = wr.account.driver?.userId;
      const notifyPayload: NotifyPayload | null = driverUserId
        ? {
            userId: driverUserId,
            amount: netPayout.toFixed(2),
            currency: wr.account.currency,
            payoutMethod,
            withdrawalRequestId: wr.id,
          }
        : null;
      return {
        notify: notifyPayload,
        logMeta: {
          requestId: wr.id,
          amount: netPayout,
          grossDebit,
          currency: wr.account.currency,
          payoutMethod,
        },
      };
    });

    if (notify) {
      void notifyUserFiatPayoutSent({
        ...notify,
        relatedEntityType: "DriverWithdrawalRequest",
      });
    }

    const noteTrim = adminNote || null;
    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: auth.role,
        actionType: "FIAT_SEND_MONEY",
        targetType: "DRIVER_WITHDRAWAL_REQUEST",
        targetId: logMeta.requestId,
        oldValue: "PENDING",
        newValue: JSON.stringify({
          status: "ACCEPTED",
          amount: logMeta.amount,
          currency: logMeta.currency,
          payoutMethod: logMeta.payoutMethod,
          actorPseudo: auth.pseudo,
          actorEmail: auth.email,
        }),
        reason: noteTrim,
      });
    } catch (logErr) {
      console.error("Failed to log FIAT_SEND_MONEY action:", logErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: e?.message || "Failed" }, { status: code });
  }
}
