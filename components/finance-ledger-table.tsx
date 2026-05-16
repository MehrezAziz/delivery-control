"use client";

import type { FinanceLedgerRow } from "@/lib/finance-ledger";

const TYPE_COLORS: Record<string, string> = {
  TOP_UP: "bg-green-100 text-green-700",
  ORDER_PAYMENT: "bg-red-100 text-red-700",
  REFUND: "bg-blue-100 text-blue-700",
  WITHDRAWAL_REQUEST: "bg-yellow-100 text-yellow-700",
  WITHDRAWAL_APPROVED: "bg-green-100 text-green-700",
  WITHDRAWAL_REJECTED: "bg-orange-100 text-orange-700",
  BONUS: "bg-purple-100 text-purple-700",
  REFERRAL_REWARD: "bg-emerald-100 text-emerald-700",
  ADJUSTMENT: "bg-gray-100 text-gray-700",
  COIN_TRANSFER_SENT: "bg-orange-100 text-orange-700",
  COIN_TRANSFER_RECEIVED: "bg-green-100 text-green-700",
  COIN_PURCHASE: "bg-sky-100 text-sky-700",
  COIN_PURCHASE_PENDING: "bg-yellow-100 text-yellow-800",
  COIN_PURCHASE_FAILED: "bg-red-100 text-red-700",
  PLATFORM_FEE: "bg-red-100 text-red-700",
  DEPOSIT: "bg-green-100 text-green-700",
  WITHDRAWAL: "bg-yellow-100 text-yellow-700",
  PENALTY: "bg-orange-100 text-orange-700",
  DISPUTE_DEBIT: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
};

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export function FinanceLedgerTable({
  rows,
  loading,
  showStatus = true,
  showOrder = true,
}: {
  rows: FinanceLedgerRow[];
  loading?: boolean;
  showStatus?: boolean;
  showOrder?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading transactions...</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions yet</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {rows.length} transaction{rows.length === 1 ? "" : "s"} (newest first)
      </p>
      <div className="max-h-[min(70vh,560px)] overflow-y-auto rounded border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
              {showStatus && (
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
              )}
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance after</th>
              {showOrder && (
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Order</th>
              )}
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id} className="border-t">
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {new Date(tx.createdAt).toLocaleDateString()}{" "}
                  {new Date(tx.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${TYPE_COLORS[tx.type] || "bg-gray-100 text-gray-700"}`}
                  >
                    {typeLabel(tx.type)}
                  </span>
                </td>
                {showStatus && (
                  <td className="px-3 py-2">
                    {tx.status ? (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[tx.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {tx.status}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )}
                <td
                  className={`px-3 py-2 text-right font-medium whitespace-nowrap ${tx.amount < 0 ? "text-red-600" : tx.amount > 0 ? "text-green-600" : "text-muted-foreground"}`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount.toFixed(2)}
                  {tx.fiatAmount != null && tx.fiatCurrency ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      paid {tx.fiatAmount.toFixed(2)} {tx.fiatCurrency}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                  {tx.balanceAfter != null ? tx.balanceAfter.toFixed(2) : "—"}
                </td>
                {showOrder && (
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                    {tx.orderShortId ? `#${tx.orderShortId}` : "—"}
                  </td>
                )}
                <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={tx.description || tx.referenceId || undefined}>
                  {tx.description || tx.referenceId || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
