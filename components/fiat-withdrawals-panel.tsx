"use client";

import { useCallback, useEffect, useState } from "react";
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

type CustomerRow = {
  id: string;
  kind: "customer_wallet";
  amount: number;
  payoutMethod: string;
  payoutBankHolderName?: string | null;
  payoutBankName?: string | null;
  payoutBankAccountRef?: string | null;
  description: string | null;
  requestedAt: string;
  walletBalance: number;
  customer: { id: string; name: string; phone: string | null; userId: string } | null;
};

type DriverRow = {
  id: string;
  kind: "driver_account";
  amount: number;
  payoutMethod: string;
  payoutBankHolderName?: string | null;
  payoutBankName?: string | null;
  payoutBankAccountRef?: string | null;
  description: string | null;
  requestedAt: string;
  accountBalance: number;
  driver: { id: string; name: string; phone: string | null; userId: string } | null;
};

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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<
    | { type: "customer"; id: string; amount: number; label: string }
    | { type: "driver"; id: string; amount: number; label: string }
    | null
  >(null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/staff/fiat-withdrawals");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setCustomer(j.customer || []);
      setDriver(j.driver || []);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openMarkSent = (
    type: "customer" | "driver",
    id: string,
    amount: number,
    label: string,
  ) => {
    setPending({ type, id, amount, label });
    setAdminNote("");
    setDialogOpen(true);
  };

  const confirmMarkSent = async () => {
    if (!pending) return;
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
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading payout queue…</p>;
  }

  return (
    <div className="space-y-8">
      {err && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {err}
        </div>
      )}
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
                    <td className="p-2 font-mono">{r.amount.toFixed(2)}</td>
                    <td className="p-2">{r.payoutMethod}</td>
                    <td className="p-2 align-top">
                      <BankPayoutCell
                        payoutMethod={r.payoutMethod}
                        holder={r.payoutBankHolderName}
                        bankName={r.payoutBankName}
                        accountRef={r.payoutBankAccountRef}
                      />
                    </td>
                    <td className="p-2 font-mono">{r.walletBalance.toFixed(2)}</td>
                    <td className="p-2">{new Date(r.requestedAt).toLocaleString()}</td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        disabled={r.amount > r.walletBalance}
                        onClick={() =>
                          openMarkSent(
                            "customer",
                            r.id,
                            r.amount,
                            `Customer withdrawal ${r.amount.toFixed(2)} (${r.customer?.name})`,
                          )
                        }
                      >
                        Money sent
                      </Button>
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
                    <td className="p-2 font-mono">{r.amount.toFixed(2)}</td>
                    <td className="p-2">{r.payoutMethod}</td>
                    <td className="p-2 align-top">
                      <BankPayoutCell
                        payoutMethod={r.payoutMethod}
                        holder={r.payoutBankHolderName}
                        bankName={r.payoutBankName}
                        accountRef={r.payoutBankAccountRef}
                      />
                    </td>
                    <td className="p-2 font-mono">{r.accountBalance.toFixed(2)}</td>
                    <td className="p-2">{new Date(r.requestedAt).toLocaleString()}</td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        disabled={r.amount > r.accountBalance}
                        onClick={() =>
                          openMarkSent(
                            "driver",
                            r.id,
                            r.amount,
                            `Driver withdrawal ${r.amount.toFixed(2)} (${r.driver?.name})`,
                          )
                        }
                      >
                        Money sent
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm manual payout</DialogTitle>
            <DialogDescription>
              You are about to record that money was sent for: <strong>{pending?.label}</strong>. This will{" "}
              <strong>subtract {pending?.amount.toFixed(2)}</strong> from the user&apos;s available balance. This
              cannot be undone from this screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="adminNote">Internal note (optional)</Label>
            <Textarea
              id="adminNote"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. wired to bank ref …"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmMarkSent()} disabled={submitting}>
              {submitting ? "Saving…" : "Confirm — money sent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
