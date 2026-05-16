import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canProcessFiatWithdrawals } from "@/lib/staff-withdrawal-access";
import { notifyUserFiatPayoutRejected } from "@/lib/notify-fiat-payout-rejected";
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
    const reason =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 2000)
        : "";
    if (!reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const wr = await prisma.driverWithdrawalRequest.findUnique({
      where: { id: requestId },
      include: { account: { include: { driver: true } } },
    });
    if (!wr || wr.status !== "PENDING") {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 400 });
    }

    await prisma.driverWithdrawalRequest.update({
      where: { id: wr.id },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
        rejectionReason: reason,
      },
    });

    const userId = wr.account.driver?.userId;
    const amt = Number(wr.amount);
    if (userId) {
      void notifyUserFiatPayoutRejected({
        userId,
        amount: amt.toFixed(2),
        reason,
        withdrawalRequestId: wr.id,
        relatedEntityType: "DriverWithdrawalRequest",
      });
    }

    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: auth.role,
        actionType: "FIAT_WITHDRAWAL_REJECTED",
        targetType: "DRIVER_WITHDRAWAL_REQUEST",
        targetId: wr.id,
        oldValue: "PENDING",
        newValue: "REJECTED",
        reason,
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    const code = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status: code });
  }
}
