import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canProcessFiatWithdrawals } from "@/lib/staff-withdrawal-access";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!canProcessFiatWithdrawals(auth)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const [customerRows, driverRows] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { requestedAt: "desc" },
        take: 100,
        include: {
          wallet: {
            include: {
              customer: {
                include: { user: { select: { id: true, firstName: true, secondName: true, phone: true } } },
              },
            },
          },
        },
      }),
      prisma.driverWithdrawalRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { requestedAt: "desc" },
        take: 100,
        include: {
          account: {
            include: {
              driver: {
                include: { user: { select: { id: true, firstName: true, secondName: true, phone: true } } },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      customer: customerRows.map((r) => ({
        id: r.id,
        kind: "customer_wallet" as const,
        amount: Number(r.amount),
        payoutMethod: r.payoutMethod,
        payoutBankHolderName: r.payoutBankHolderName,
        payoutBankName: r.payoutBankName,
        payoutBankAccountRef: r.payoutBankAccountRef,
        description: r.descriptionOfCustomer,
        requestedAt: r.requestedAt,
        walletBalance: Number(r.wallet.balance),
        customer: r.wallet.customer
          ? {
              id: r.wallet.customer.id,
              name: `${r.wallet.customer.user?.firstName || ""} ${r.wallet.customer.user?.secondName || ""}`.trim(),
              phone: r.wallet.customer.user?.phone,
              userId: r.wallet.customer.userId,
            }
          : null,
      })),
      driver: driverRows.map((r) => ({
        id: r.id,
        kind: "driver_account" as const,
        amount: Number(r.amount),
        payoutMethod: r.payoutMethod,
        payoutBankHolderName: r.payoutBankHolderName,
        payoutBankName: r.payoutBankName,
        payoutBankAccountRef: r.payoutBankAccountRef,
        description: r.descriptionFromDriver,
        requestedAt: r.requestedAt,
        accountBalance: Number(r.account.balance),
        driver: r.account.driver
          ? {
              id: r.account.driver.id,
              name: `${r.account.driver.user?.firstName || ""} ${r.account.driver.user?.secondName || ""}`.trim(),
              phone: r.account.driver.user?.phone,
              userId: r.account.driver.userId,
            }
          : null,
      })),
    });
  } catch (e: any) {
    const msg = e?.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Failed" }, { status: msg });
  }
}
