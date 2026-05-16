/** Convert wallet coins to local fiat using active country coin config (coins per 1.00 fiat unit). */
export function coinsToLocalFiat(coins: number, coinsPerFiatUnit: number | null | undefined): number | null {
  const rate = coinsPerFiatUnit != null ? Number(coinsPerFiatUnit) : NaN;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.round((coins / rate) * 100) / 100;
}

export type FiatPayoutAmountView = {
  netCoins: number;
  grossCoins: number;
  feeCoins: number;
  currencyCode: string;
  currencySymbol: string;
  netFiat: number | null;
  grossFiat: number | null;
};

export function buildFiatPayoutAmountView(
  grossCoins: number,
  feeCoins: number,
  currencyCode: string,
  currencySymbol: string,
  coinsPerFiatUnit: number | null | undefined,
): FiatPayoutAmountView {
  const netCoins = Math.round((grossCoins - feeCoins) * 100) / 100;
  return {
    netCoins,
    grossCoins,
    feeCoins,
    currencyCode: currencyCode || "—",
    currencySymbol: currencySymbol || currencyCode || "",
    netFiat: coinsToLocalFiat(netCoins, coinsPerFiatUnit),
    grossFiat: coinsToLocalFiat(grossCoins, coinsPerFiatUnit),
  };
}
