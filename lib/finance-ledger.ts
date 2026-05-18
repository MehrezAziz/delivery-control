import type {
  CoinTopupPayerRole,
  CoinTopupSession,
  CoinTopupSessionStatus,
  DriverTransaction,
  PrismaClient,
  WalletTransaction,
} from "@prisma/client";

/** Unified row for admin finance history (wallet, driver account, coin purchases). */
export type FinanceLedgerRow = {
  id: string;
  source: "WALLET" | "DRIVER" | "TOPUP";
  createdAt: string;
  type: string;
  amount: number;
  status?: string;
  balanceAfter?: number | null;
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  orderShortId?: string | null;
  fiatAmount?: number | null;
  fiatCurrency?: string | null;
};

type WalletTxWithOrder = WalletTransaction & { order?: { id: string } | null };
type DriverTx = DriverTransaction;

type TopupRow = {
  id: string;
  userId: string;
  payerRole: string;
  countryId: string;
  coinsAmount: unknown;
  fiatAmount: unknown;
  fiatCurrencyCode: string;
  amountMillimes: number;
  coinsPerFiatUnit: unknown;
  developerTrackingId: string;
  flouciPaymentId: string | null;
  checkoutUrl: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
};

function topupTypeLabel(status: string): string {
  if (status === "PENDING") return "COIN_PURCHASE_PENDING";
  if (status === "FAILED") return "COIN_PURCHASE_FAILED";
  return "COIN_PURCHASE";
}

function mapWalletTx(t: WalletTxWithOrder): FinanceLedgerRow {
  return {
    id: t.id,
    source: "WALLET",
    createdAt: t.createdAt.toISOString(),
    type: t.type,
    amount: Number(t.amount),
    status: t.status,
    balanceAfter: Number(t.balanceAfter),
    referenceId: t.referenceId,
    referenceType: t.referenceType,
    orderShortId: t.order?.id ? t.order.id.slice(0, 8) : null,
  };
}

function mapDriverTx(t: DriverTx): FinanceLedgerRow {
  return {
    id: t.id,
    source: "DRIVER",
    createdAt: t.createdAt.toISOString(),
    type: t.type,
    amount: Number(t.amount),
    balanceAfter: Number(t.balanceAfter),
    description: t.description,
    referenceId: t.referenceId,
    referenceType: t.referenceType,
  };
}

function mapTopupSession(s: CoinTopupSession | TopupRow): FinanceLedgerRow {
  const coins = Number(s.coinsAmount);
  const status = String(s.status);
  const amount =
    status === "COMPLETED" ? coins : status === "PENDING" ? coins : 0;
  return {
    id: `topup-${s.id}`,
    source: "TOPUP",
    createdAt: (s.completedAt ?? s.createdAt).toISOString(),
    type: topupTypeLabel(status),
    amount,
    status,
    balanceAfter: null,
    description: `Coin purchase · ${Number(s.fiatAmount).toFixed(2)} ${s.fiatCurrencyCode}`,
    referenceId: s.flouciPaymentId ?? s.developerTrackingId,
    referenceType: "FLOUCI_TOPUP",
    fiatAmount: Number(s.fiatAmount),
    fiatCurrency: s.fiatCurrencyCode,
  };
}

function creditedReferenceIds(
  walletTxs: WalletTxWithOrder[],
  driverTxs: DriverTx[],
): Set<string> {
  const ids = new Set<string>();
  for (const t of walletTxs) {
    if (t.referenceId) ids.add(t.referenceId);
  }
  for (const t of driverTxs) {
    if (t.referenceId) ids.add(t.referenceId);
  }
  return ids;
}

function toCoinTopupSession(row: TopupRow): CoinTopupSession {
  return {
    id: row.id,
    userId: row.userId,
    payerRole: row.payerRole as CoinTopupPayerRole,
    countryId: row.countryId,
    coinsAmount: row.coinsAmount as CoinTopupSession["coinsAmount"],
    fiatAmount: row.fiatAmount as CoinTopupSession["fiatAmount"],
    fiatCurrencyCode: row.fiatCurrencyCode,
    amountMillimes: row.amountMillimes,
    coinsPerFiatUnit: row.coinsPerFiatUnit as CoinTopupSession["coinsPerFiatUnit"],
    developerTrackingId: row.developerTrackingId,
    flouciPaymentId: row.flouciPaymentId,
    checkoutUrl: row.checkoutUrl ?? null,
    status: row.status as CoinTopupSessionStatus,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

async function fetchCoinTopupSessionsRaw(
  prisma: PrismaClient,
  userId: string,
  payerRole: CoinTopupPayerRole,
): Promise<CoinTopupSession[]> {
  const rows = await prisma.$queryRaw<TopupRow[]>`
    SELECT
      id,
      user_id AS "userId",
      payer_role::text AS "payerRole",
      country_id AS "countryId",
      coins_amount AS "coinsAmount",
      fiat_amount AS "fiatAmount",
      fiat_currency_code AS "fiatCurrencyCode",
      amount_millimes AS "amountMillimes",
      coins_per_fiat_unit AS "coinsPerFiatUnit",
      developer_tracking_id AS "developerTrackingId",
      flouci_payment_id AS "flouciPaymentId",
      checkout_url AS "checkoutUrl",
      status::text AS status,
      created_at AS "createdAt",
      completed_at AS "completedAt"
    FROM coin_topup_sessions
    WHERE user_id = ${userId}
      AND payer_role::text = ${payerRole}
    ORDER BY created_at DESC
  `;
  return rows.map(toCoinTopupSession);
}

/** Never throws — coin top-up history is optional if Prisma client is out of sync. */
export async function fetchCoinTopupSessions(
  prisma: PrismaClient,
  userId: string,
  payerRole: CoinTopupPayerRole,
): Promise<CoinTopupSession[]> {
  try {
    return await prisma.coinTopupSession.findMany({
      where: { userId, payerRole },
      orderBy: { createdAt: "desc" },
    });
  } catch (delegateErr) {
    console.warn(
      "[finance-ledger] coinTopupSession delegate failed, trying raw SQL",
      delegateErr instanceof Error ? delegateErr.message : delegateErr,
    );
    try {
      return await fetchCoinTopupSessionsRaw(prisma, userId, payerRole);
    } catch (rawErr) {
      console.warn(
        "[finance-ledger] coin top-up raw query failed",
        rawErr instanceof Error ? rawErr.message : rawErr,
      );
      return [];
    }
  }
}

export function buildCustomerFinanceLedger(
  walletTxs: WalletTxWithOrder[],
  topupSessions: CoinTopupSession[],
): FinanceLedgerRow[] {
  const credited = creditedReferenceIds(walletTxs, []);
  const rows: FinanceLedgerRow[] = walletTxs.map(mapWalletTx);

  for (const s of topupSessions) {
    if (s.status === "COMPLETED") {
      const refs = [s.flouciPaymentId, s.developerTrackingId].filter(Boolean) as string[];
      if (refs.some((r) => credited.has(r))) continue;
    }
    rows.push(mapTopupSession(s));
  }

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function buildDriverFinanceLedger(
  driverTxs: DriverTx[],
  topupSessions: CoinTopupSession[],
): FinanceLedgerRow[] {
  const credited = creditedReferenceIds([], driverTxs);
  const rows: FinanceLedgerRow[] = driverTxs.map(mapDriverTx);

  for (const s of topupSessions) {
    if (s.status === "COMPLETED") {
      const refs = [s.flouciPaymentId, s.developerTrackingId].filter(Boolean) as string[];
      if (refs.some((r) => credited.has(r))) continue;
    }
    rows.push(mapTopupSession(s));
  }

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function financeApiErrorResponse(e: unknown): { body: { error: string }; status: number } {
  if (e instanceof Error && e.message === "Unauthorized") {
    return { body: { error: "Unauthorized" }, status: 401 };
  }
  const message = e instanceof Error ? e.message : "Internal server error";
  console.error("[finance-api]", e);
  return { body: { error: message }, status: 500 };
}
