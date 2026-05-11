import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canProcessFiatWithdrawals } from "@/lib/staff-withdrawal-access";

/** Completed fiat payouts (money marked sent — ACCEPTED). */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!canProcessFiatWithdrawals(auth)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const take = 150;

    const [customerRows, driverRows] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where: { status: "ACCEPTED" },
        orderBy: { processedAt: "desc" },
        take,
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
        where: { status: "ACCEPTED" },
        orderBy: { processedAt: "desc" },
        take,
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

    const mapCustomer = (r: (typeof customerRows)[0]) => ({
      id: r.id,
      kind: "customer_wallet" as const,
      amount: Number(r.amount),
      payoutMethod: r.payoutMethod,
      payoutBankHolderName: r.payoutBankHolderName,
      payoutBankName: r.payoutBankName,
      payoutBankAccountRef: r.payoutBankAccountRef,
      description: r.descriptionOfCustomer,
      requestedAt: r.requestedAt.toISOString(),
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
      walletCurrency: r.wallet.currency,
      customer: r.wallet.customer
        ? {
            id: r.wallet.customer.id,
            name: `${r.wallet.customer.user?.firstName || ""} ${r.wallet.customer.user?.secondName || ""}`.trim(),
            phone: r.wallet.customer.user?.phone,
            userId: r.wallet.customer.userId,
          }
        : null,
    });

    const mapDriver = (r: (typeof driverRows)[0]) => ({
      id: r.id,
      kind: "driver_account" as const,
      amount: Number(r.amount),
      payoutMethod: r.payoutMethod,
      payoutBankHolderName: r.payoutBankHolderName,
      payoutBankName: r.payoutBankName,
      payoutBankAccountRef: r.payoutBankAccountRef,
      description: r.descriptionFromDriver,
      requestedAt: r.requestedAt.toISOString(),
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
      accountCurrency: r.account.currency,
      driver: r.account.driver
        ? {
            id: r.account.driver.id,
            name: `${r.account.driver.user?.firstName || ""} ${r.account.driver.user?.secondName || ""}`.trim(),
            phone: r.account.driver.user?.phone,
            userId: r.account.driver.userId,
          }
        : null,
    });

    return NextResponse.json({
      customer: customerRows.map(mapCustomer),
      driver: driverRows.map(mapDriver),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: msg });
  }
}
