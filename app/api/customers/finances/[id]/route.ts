import { NextRequest, NextResponse } from "next/server";
import { CoinTopupPayerRole } from "@prisma/client";
import { requireAuth, hasCSRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildCustomerFinanceLedger,
  fetchCoinTopupSessions,
  financeApiErrorResponse,
} from "@/lib/finance-ledger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    if (auth.role === "CUSTOMER_SERVICE") {
      if (!hasCSRole(auth, "VIEW_FINANCIAL_REPORTS") && !hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    const wallet = await prisma.digitalWallet.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, firstName: true, secondName: true, phone: true } },
            myReferralCode: { select: { code: true } },
          },
        },
      },
    });

    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    const walletTxs = await prisma.walletTransaction.findMany({
      where: { walletId: id },
      orderBy: { createdAt: "desc" },
      include: { order: { select: { id: true } } },
    });
    const topupSessions = await fetchCoinTopupSessions(
      prisma,
      wallet.customer.user.id,
      CoinTopupPayerRole.CUSTOMER,
    );

    const transactions = buildCustomerFinanceLedger(walletTxs, topupSessions);

    return NextResponse.json({
      id: wallet.id,
      customerId: wallet.customerId,
      balance: Number(wallet.balance),
      lockedForTransfers: Number(wallet.lockedForTransfers),
      currency: wallet.currency,
      discount: Number(wallet.discount),
      customerName:
        `${wallet.customer.user.firstName || ""} ${wallet.customer.user.secondName || ""}`.trim() ||
        "Unknown",
      phone: wallet.customer.user.phone,
      customerStatus: wallet.customer.customerStatus,
      referralCode: wallet.customer.myReferralCode?.code ?? null,
      transactionCount: transactions.length,
      transactions,
    });
  } catch (e: unknown) {
    const { body, status } = financeApiErrorResponse(e);
    return NextResponse.json(body, { status });
  }
}
