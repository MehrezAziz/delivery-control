"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PayoutAmountFields = {
  currencyCode: string;
  currencySymbol: string;
  netPayoutCoins: number;
  netPayoutFiat: number | null;
  grossDebitFiat: number | null;
};

type CustomerRow = {
  id: string;
  kind: "customer_wallet";
  amount: number;
  feeAmount: number;
  payoutMethod: string;
  payoutBankHolderName?: string | null;
  payoutBankName?: string | null;
  payoutBankAccountRef?: string | null;
  description: string | null;
  requestedAt: string;
  walletBalance: number;
  walletCurrency: string;
  customer: { id: string; name: string; phone: string | null; userId: string } | null;
} & PayoutAmountFields;

type DriverRow = {
  id: string;
  kind: "driver_account";
  amount: number;
  feeAmount: number;
  payoutMethod: string;
  payoutBankHolderName?: string | null;
  payoutBankName?: string | null;
  payoutBankAccountRef?: string | null;
  description: string | null;
  requestedAt: string;
  accountBalance: number;
  accountCurrency: string;
  driver: { id: string; name: string; phone: string | null; userId: string } | null;
} & PayoutAmountFields;

type CustomerHist = Omit<CustomerRow, "walletBalance"> & {
  processedAt: string | null;
  walletCurrency: string;
};

type DriverHist = Omit<DriverRow, "accountBalance"> & {
  processedAt: string | null;
  accountCurrency: string;
};

type HistMerged = (CustomerHist & { role: "customer" }) | (DriverHist & { role: "driver" });

function formatFiatAmount(value: number, currencyCode: string) {
  return `${value.toFixed(2)} ${currencyCode}`;
}

function PayoutAmountCell({
  grossCoins,
  feeCoins,
  netPayoutCoins,
  netPayoutFiat,
  grossDebitFiat,
  currencyCode,
}: {
  grossCoins: number;
  feeCoins: number;
  netPayoutCoins: number;
  netPayoutFiat: number | null;
  grossDebitFiat: number | null;
  currencyCode: string;
}) {
  return (
    <div>
      <span className="text-lg font-semibold tabular-nums tracking-tight">
        {netPayoutFiat != null
          ? formatFiatAmount(netPayoutFiat, currencyCode)
          : `${netPayoutCoins.toFixed(2)} Coins`}
      </span>
      {netPayoutFiat != null ? (
        <span className="block text-xs text-muted-foreground tabular-nums">
          {netPayoutCoins.toFixed(2)} coins
        </span>
      ) : null}
      {feeCoins > 0 ? (
        <span className="block text-xs text-muted-foreground">
          Fee {feeCoins.toFixed(2)} coins
          {grossDebitFiat != null ? ` · wallet debit ${formatFiatAmount(grossDebitFiat, currencyCode)}` : ` · ${grossCoins.toFixed(2)} coins debited`}
        </span>
      ) : grossDebitFiat != null ? (
        <span className="block text-xs text-muted-foreground">
          Wallet debit {formatFiatAmount(grossDebitFiat, currencyCode)}
        </span>
      ) : (
        <span className="block text-xs text-muted-foreground">Wallet debit {grossCoins.toFixed(2)} coins</span>
      )}
    </div>
  );
}

function BankPayoutCell({
  payoutMethod,
  holder,
  bankName,
  accountRef,
}: {
  payoutMethod: string;
  holder?: string | null;
  bankName?: string | null;
  accountRef?: string | null;
}) {
  if (payoutMethod !== "BANK_TRANSFER") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (!holder && !bankName && !accountRef) {
    return <span className="text-xs text-amber-700 dark:text-amber-400">No bank details on file</span>;
  }
  return (
    <div className="max-w-[240px] text-xs leading-snug">
      {holder ? <div>{holder}</div> : null}
      {bankName ? <div className="text-muted-foreground">{bankName}</div> : null}
      {accountRef ? <div className="font-mono break-all text-muted-foreground">{accountRef}</div> : null}
    </div>
  );
}

export function FiatWithdrawalsPanel() {
  const [customer, setCustomer] = useState<CustomerRow[]>([]);
  const [driver, setDriver] = useState<DriverRow[]>([]);
  const [histCustomer, setHistCustomer] = useState<CustomerHist[]>([]);
  const [histDriver, setHistDriver] = useState<DriverHist[]>([]);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<"preview" | "confirm">("preview");
  const [pending, setPending] = useState<
    | ({
        type: "customer";
        id: string;
        amount: number;
        feeAmount: number;
        payoutMethod: string;
        label: string;
        walletBalance: number;
      } & PayoutAmountFields)
    | ({
        type: "driver";
        id: string;
        amount: number;
        feeAmount: number;
        payoutMethod: string;
        label: string;
        accountBalance: number;
      } & PayoutAmountFields)
    | null
  >(null);
  const [adminNote, setAdminNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ type: "customer" | "driver"; id: string; label: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/staff/fiat-withdrawals");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setCustomer(j.customer || []);
      setDriver(j.driver || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/staff/fiat-withdrawals/history");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setHistCustomer(j.customer || []);
      setHistDriver(j.driver || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const mergedHistory = useMemo(() => {
    const rows: HistMerged[] = [
      ...histCustomer.map((r) => ({ ...r, role: "customer" as const })),
      ...histDriver.map((r) => ({ ...r, role: "driver" as const })),
    ];
    rows.sort((a, b) => {
      const ta = a.processedAt ? new Date(a.processedAt).getTime() : 0;
      const tb = b.processedAt ? new Date(b.processedAt).getTime() : 0;
      return tb - ta;
    });
    return rows;
  }, [histCustomer, histDriver]);

  const openMarkSent = (
    row:
      | (CustomerRow & { label: string })
      | (DriverRow & { label: string }),
    type: "customer" | "driver",
    balance: number,
  ) => {
    const base = {
      id: row.id,
      amount: row.amount,
      feeAmount: row.feeAmount ?? 0,
      payoutMethod: row.payoutMethod,
      label: row.label,
      currencyCode: row.currencyCode,
      currencySymbol: row.currencySymbol,
      netPayoutCoins: row.netPayoutCoins,
      netPayoutFiat: row.netPayoutFiat,
      grossDebitFiat: row.grossDebitFiat,
    };
    setPending(
      type === "customer"
        ? { type: "customer", ...base, walletBalance: balance }
        : { type: "driver", ...base, accountBalance: balance },
    );
    setAdminNote("");
    setDialogStep("preview");
    setDialogOpen(true);
  };

  const openReject = (type: "customer" | "driver", id: string, label: string) => {
    setRejectTarget({ type, id, label });
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    const path =
      rejectTarget.type === "customer"
        ? `/api/staff/fiat-withdrawals/customer/${rejectTarget.id}/reject`
        : `/api/staff/fiat-withdrawals/driver/${rejectTarget.id}/reject`;
    setSubmitting(true);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed");
      setRejectOpen(false);
      setRejectTarget(null);
      await loadQueue();
      await loadHistory();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmMarkSent = async () => {
    if (!pending) return;
    if (pending.payoutMethod === "CASH" && !adminNote.trim()) {
      setErr("Internal note is required for cash payouts");
      return;
    }
    const path =
      pending.type === "customer"
        ? `/api/staff/fiat-withdrawals/customer/${pending.id}/mark-sent`
        : `/api/staff/fiat-withdrawals/driver/${pending.id}/mark-sent`;
    setSubmitting(true);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, adminNote: adminNote.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed");
      setDialogOpen(false);
      setPending(null);
      await loadQueue();
      await loadHistory();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const balanceForPending =
    pending?.type === "customer" ? pending.walletBalance : pending?.type === "driver" ? pending.accountBalance : 0;
  const netPayoutForPending = pending
    ? Math.round((pending.amount - (pending.feeAmount ?? 0)) * 100) / 100
    : 0;
  const totalDebitForPending = pending ? pending.amount : 0;
  const cashPayoutPending = pending?.payoutMethod === "CASH";

  if (loading) {
    return <p className="text-muted-foreground">Loading payout queue…</p>;
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {err}
        </div>
      )}

      <Tabs
        defaultValue="queue"
        onValueChange={(v) => {
          if (v === "history" && !historyFetched) {
            setHistoryFetched(true);
            void loadHistory();
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="queue">Pending queue</TabsTrigger>
          <TabsTrigger value="history">Fiat payout done (history)</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-6 space-y-8">
          <div>
            <h2 className="text-lg font-semibold">Customer wallet → cash / bank</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              After you send money manually, mark as sent. The customer&apos;s coin balance will be reduced by the request
              amount.
            </p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2">Customer</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Bank details</th>
                    <th className="p-2">Wallet bal.</th>
                    <th className="p-2">Requested</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {customer.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-muted-foreground">
                        No pending customer withdrawals
                      </td>
                    </tr>
                  ) : (
                    customer.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{r.customer?.name || "—"}</td>
                        <td className="p-2">
                          <PayoutAmountCell
                            grossCoins={r.amount}
                            feeCoins={r.feeAmount ?? 0}
                            netPayoutCoins={r.netPayoutCoins}
                            netPayoutFiat={r.netPayoutFiat}
                            grossDebitFiat={r.grossDebitFiat}
                            currencyCode={r.currencyCode}
                          />
                        </td>
                        <td className="p-2">{r.payoutMethod}</td>
                        <td className="p-2 align-top">
                          <BankPayoutCell
                            payoutMethod={r.payoutMethod}
                            holder={r.payoutBankHolderName}
                            bankName={r.payoutBankName}
                            accountRef={r.payoutBankAccountRef}
                          />
                        </td>
                        <td className="p-2 text-xs text-muted-foreground tabular-nums">{r.walletBalance.toFixed(2)}</td>
                        <td className="p-2">{new Date(r.requestedAt).toLocaleString()}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openReject("customer", r.id, `Customer ${r.customer?.name || ""}`)
                              }
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={r.amount > r.walletBalance}
                              onClick={() =>
                                openMarkSent(
                                  {
                                    ...r,
                                    label: `Customer withdrawal (${r.customer?.name || ""})`,
                                  },
                                  "customer",
                                  r.walletBalance,
                                )
                              }
                            >
                              Money sent
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Driver account → cash / bank</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Marks the driver&apos;s in-app balance as paid out (coins / TND ledger).
            </p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2">Driver</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Bank details</th>
                    <th className="p-2">Account bal.</th>
                    <th className="p-2">Requested</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {driver.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-muted-foreground">
                        No pending driver withdrawals
                      </td>
                    </tr>
                  ) : (
                    driver.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{r.driver?.name || "—"}</td>
                        <td className="p-2">
                          <PayoutAmountCell
                            grossCoins={r.amount}
                            feeCoins={r.feeAmount ?? 0}
                            netPayoutCoins={r.netPayoutCoins}
                            netPayoutFiat={r.netPayoutFiat}
                            grossDebitFiat={r.grossDebitFiat}
                            currencyCode={r.currencyCode}
                          />
                        </td>
                        <td className="p-2">{r.payoutMethod}</td>
                        <td className="p-2 align-top">
                          <BankPayoutCell
                            payoutMethod={r.payoutMethod}
                            holder={r.payoutBankHolderName}
                            bankName={r.payoutBankName}
                            accountRef={r.payoutBankAccountRef}
                          />
                        </td>
                        <td className="p-2 text-xs text-muted-foreground tabular-nums">{r.accountBalance.toFixed(2)}</td>
                        <td className="p-2">{new Date(r.requestedAt).toLocaleString()}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReject("driver", r.id, `Driver ${r.driver?.name || ""}`)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={r.amount > r.accountBalance}
                              onClick={() =>
                                openMarkSent(
                                  {
                                    ...r,
                                    label: `Driver withdrawal (${r.driver?.name || ""})`,
                                  },
                                  "driver",
                                  r.accountBalance,
                                )
                              }
                            >
                              Money sent
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {histLoading ? (
            <p className="text-muted-foreground">Loading history…</p>
          ) : mergedHistory.length === 0 ? (
            <p className="text-muted-foreground">No completed fiat payouts yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2">Role</th>
                    <th className="p-2">User</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Bank details</th>
                    <th className="p-2">Requested</th>
                    <th className="p-2">Sent / processed</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedHistory.map((r) => (
                    <tr key={`${r.role}-${r.id}`} className="border-t">
                      <td className="p-2 capitalize">{r.role}</td>
                      <td className="p-2">
                        {r.role === "customer" ? r.customer?.name || "—" : r.driver?.name || "—"}
                      </td>
                      <td className="p-2">
                        <PayoutAmountCell
                          grossCoins={r.amount}
                          feeCoins={r.feeAmount ?? 0}
                          netPayoutCoins={r.netPayoutCoins}
                          netPayoutFiat={r.netPayoutFiat}
                          grossDebitFiat={r.grossDebitFiat}
                          currencyCode={r.currencyCode}
                        />
                      </td>
                      <td className="p-2">{r.payoutMethod}</td>
                      <td className="p-2 align-top">
                        <BankPayoutCell
                          payoutMethod={r.payoutMethod}
                          holder={r.payoutBankHolderName}
                          bankName={r.payoutBankName}
                          accountRef={r.payoutBankAccountRef}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">{new Date(r.requestedAt).toLocaleString()}</td>
                      <td className="p-2 whitespace-nowrap">
                        {r.processedAt ? new Date(r.processedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setDialogStep("preview");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogStep === "preview" ? "Review payout" : "Confirm & record"}</DialogTitle>
            <DialogDescription className={dialogStep === "preview" ? "sr-only" : undefined}>
              {dialogStep === "confirm"
                ? cashPayoutPending
                  ? "Internal note is required for cash payouts (e.g. pickup location, reference)."
                  : "Optional internal note for your records."
                : null}
            </DialogDescription>
          </DialogHeader>

          {dialogStep === "preview" && pending ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{pending.label}</p>
              <div className="rounded-lg border bg-muted/30 px-4 py-6 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount to send</p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
                  {pending.netPayoutFiat != null
                    ? formatFiatAmount(pending.netPayoutFiat, pending.currencyCode)
                    : `${netPayoutForPending.toFixed(2)} coins`}
                </p>
                {pending.netPayoutFiat != null ? (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {netPayoutForPending.toFixed(2)} coins
                  </p>
                ) : null}
                {(pending.feeAmount ?? 0) > 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pending.feeAmount.toFixed(2)} coins fee (deducted)
                    {pending.grossDebitFiat != null
                      ? ` · ${formatFiatAmount(pending.grossDebitFiat, pending.currencyCode)} debited from wallet`
                      : ` · ${totalDebitForPending.toFixed(2)} coins debited from wallet`}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pending.grossDebitFiat != null ? (
                      <>
                        <strong>{formatFiatAmount(pending.grossDebitFiat, pending.currencyCode)}</strong> debited from
                        wallet
                      </>
                    ) : (
                      <>
                        <strong>{totalDebitForPending.toFixed(2)}</strong> coins debited from wallet
                      </>
                    )}
                  </p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Current {pending.type === "customer" ? "wallet" : "account"} balance (before marking sent)
                </p>
                <p className="text-sm tabular-nums text-muted-foreground/80">{balanceForPending.toFixed(2)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Only continue if you have actually sent{" "}
                <strong>
                  {pending.netPayoutFiat != null
                    ? formatFiatAmount(pending.netPayoutFiat, pending.currencyCode)
                    : `${netPayoutForPending.toFixed(2)} coins`}
                </strong>{" "}
                (cash or bank). Confirming will debit{" "}
                <strong>
                  {pending.grossDebitFiat != null
                    ? formatFiatAmount(pending.grossDebitFiat, pending.currencyCode)
                    : `${totalDebitForPending.toFixed(2)} coins`}
                </strong>{" "}
                from the user&apos;s balance
                {(pending.feeAmount ?? 0) > 0 ? ` (includes ${pending.feeAmount.toFixed(2)} coins platform fee)` : ""}.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="adminNote">
                Internal note{cashPayoutPending ? " (required for cash)" : " (optional)"}
              </Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  cashPayoutPending ? "e.g. handed cash at office, receipt #…" : "e.g. wired to bank ref …"
                }
                rows={3}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {dialogStep === "preview" ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogStep("confirm")} disabled={submitting}>
                  Continue — money sent
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogStep("preview")} disabled={submitting}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void confirmMarkSent()}
                  disabled={submitting || (cashPayoutPending && !adminNote.trim())}
                >
                  {submitting ? "Saving…" : "Confirm — record payout"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject payout</DialogTitle>
            <DialogDescription>
              {rejectTarget?.label ?? "Withdrawal request"} — provide a reason (required). The user will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Rejection reason</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this payout cannot be processed…"
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmReject()}
              disabled={submitting || !rejectReason.trim()}
            >
              {submitting ? "Rejecting…" : "Reject payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
