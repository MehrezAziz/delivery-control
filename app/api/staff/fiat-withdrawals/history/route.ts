import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canProcessFiatWithdrawals } from "@/lib/staff-withdrawal-access";
import { activeCoinsPerFiatByCountry, activeCoinsPerFiatByCurrencyCode } from "@/lib/active-coin-rates";
import { buildFiatPayoutAmountView } from "@/lib/fiat-payout-display";

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
              country: { select: { id: true, currencyCode: true, currencySymbol: true } },
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

    const customerCountryIds = [
      ...new Set(customerRows.map((r) => r.wallet.countryId).filter(Boolean)),
    ] as string[];
    const driverCurrencies = [
      ...new Set(driverRows.map((r) => r.account.currency).filter(Boolean)),
    ] as string[];

    const [ratesByCountry, ratesByCurrency] = await Promise.all([
      activeCoinsPerFiatByCountry(prisma, customerCountryIds),
      activeCoinsPerFiatByCurrencyCode(prisma, driverCurrencies),
    ]);

    return NextResponse.json({
      customer: customerRows.map((r) => {
        const gross = Number(r.amount);
        const fee = Number(r.feeAmount ?? 0);
        const country = r.wallet.country;
        const amounts = buildFiatPayoutAmountView(
          gross,
          fee,
          country?.currencyCode ?? r.wallet.currency,
          country?.currencySymbol ?? country?.currencyCode ?? r.wallet.currency,
          ratesByCountry.get(r.wallet.countryId),
        );
        return {
          id: r.id,
          kind: "customer_wallet" as const,
          amount: gross,
          feeAmount: fee,
          payoutMethod: r.payoutMethod,
          payoutBankHolderName: r.payoutBankHolderName,
          payoutBankName: r.payoutBankName,
          payoutBankAccountRef: r.payoutBankAccountRef,
          description: r.descriptionOfCustomer,
          requestedAt: r.requestedAt.toISOString(),
          processedAt: r.processedAt ? r.processedAt.toISOString() : null,
          walletCurrency: r.wallet.currency,
          currencyCode: amounts.currencyCode,
          currencySymbol: amounts.currencySymbol,
          netPayoutCoins: amounts.netCoins,
          netPayoutFiat: amounts.netFiat,
          grossDebitFiat: amounts.grossFiat,
          customer: r.wallet.customer
            ? {
                id: r.wallet.customer.id,
                name: `${r.wallet.customer.user?.firstName || ""} ${r.wallet.customer.user?.secondName || ""}`.trim(),
                phone: r.wallet.customer.user?.phone,
                userId: r.wallet.customer.userId,
              }
            : null,
        };
      }),
      driver: driverRows.map((r) => {
        const gross = Number(r.amount);
        const fee = Number(r.feeAmount ?? 0);
        const ccy = r.account.currency;
        const amounts = buildFiatPayoutAmountView(
          gross,
          fee,
          ccy,
          ccy,
          ratesByCurrency.get(ccy),
        );
        return {
          id: r.id,
          kind: "driver_account" as const,
          amount: gross,
          feeAmount: fee,
          payoutMethod: r.payoutMethod,
          payoutBankHolderName: r.payoutBankHolderName,
          payoutBankName: r.payoutBankName,
          payoutBankAccountRef: r.payoutBankAccountRef,
          description: r.descriptionFromDriver,
          requestedAt: r.requestedAt.toISOString(),
          processedAt: r.processedAt ? r.processedAt.toISOString() : null,
          accountCurrency: r.account.currency,
          currencyCode: amounts.currencyCode,
          currencySymbol: amounts.currencySymbol,
          netPayoutCoins: amounts.netCoins,
          netPayoutFiat: amounts.netFiat,
          grossDebitFiat: amounts.grossFiat,
          driver: r.account.driver
            ? {
                id: r.account.driver.id,
                name: `${r.account.driver.user?.firstName || ""} ${r.account.driver.user?.secondName || ""}`.trim(),
                phone: r.account.driver.user?.phone,
                userId: r.account.driver.userId,
              }
            : null,
        };
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: msg });
  }
}
