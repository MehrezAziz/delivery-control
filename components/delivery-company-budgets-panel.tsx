"use client";

import { useEffect, useMemo, useState } from "react";
import { buildIdempotencyKey } from "@/lib/idempotency";

type Row = {
  id: string;
  amountCoins: string | number;
  priority: string;
  status: string;
  createdAt: string;
  decisionNote?: string | null;
  deliveryCompany?: { id?: string; name: string } | null;
  department?: { label: string; isMainDepartment?: boolean } | null;
};

type CompanyOpt = { id: string; name: string; coinBalance?: unknown; lockedCoins?: unknown };

type AuditRow = {
  id: string;
  actionType: string;
  actorType: string;
  actorRef: string | null;
  details: unknown;
  createdAt: string;
  deliveryCompany?: { id: string; name: string };
};

type DeliveryCompanyBudgetsPanelProps = {
  /** Admin-only: add / withdraw coins on the company main wallet. Hidden for Customer Service. */
  showFinanceAdjust?: boolean;
};

export function DeliveryCompanyBudgetsPanel({ showFinanceAdjust = true }: DeliveryCompanyBudgetsPanelProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState("");
  const [budgetFilterCompanyId, setBudgetFilterCompanyId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/delivery-companies/budget-requests");
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to load");
    setRows(Array.isArray(data) ? data : []);
  };

  const loadCompanies = async () => {
    const res = await fetch("/api/delivery-companies");
    const data = await res.json();
    if (!res.ok) return;
    setCompanies(Array.isArray(data) ? data : []);
  };

  const loadAudit = async () => {
    const res = await fetch("/api/delivery-companies/finance-audit?take=80");
    const data = await res.json();
    if (!res.ok) return;
    setAudit(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    void load();
    void loadCompanies();
    void loadAudit();
  }, []);

  const groupedBudgetRows = useMemo(() => {
    const filtered = budgetFilterCompanyId
      ? rows.filter((r) => r.deliveryCompany?.id === budgetFilterCompanyId)
      : rows;
    const map = new Map<string, { companyName: string; rows: Row[] }>();
    for (const r of filtered) {
      const cid = r.deliveryCompany?.id || "_unknown";
      const name = r.deliveryCompany?.name || "Unknown company";
      if (!map.has(cid)) map.set(cid, { companyName: name, rows: [] });
      map.get(cid)!.rows.push(r);
    }
    const entries = [...map.entries()].sort((a, b) => a[1].companyName.localeCompare(b[1].companyName));
    return entries;
  }, [rows, budgetFilterCompanyId]);

  const update = async (id: string, status: "APPROVED" | "REJECTED") => {
    const idemKey = buildIdempotencyKey("admin-deliverycompany-budget-decision", { id, status });
    const res = await fetch(`/api/delivery-companies/budget-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to update");
    await load();
    await loadAudit();
  };

  const submitAdjust = async (sign: 1 | -1) => {
    setMessage(null);
    const raw = parseFloat(String(adjustAmount).replace(",", "."));
    if (!companyId) {
      setMessage("Select a company");
      return;
    }
    if (!Number.isFinite(raw) || raw <= 0) {
      setMessage("Enter a positive amount");
      return;
    }
    const amountCoins = Math.round(raw * sign * 100) / 100;
    const idemKey = buildIdempotencyKey("company-finance-adjust", {
      companyId,
      amountCoins,
      reason: adjustReason,
    });
    setAdjustBusy(true);
    try {
      const res = await fetch("/api/delivery-companies/finance-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({
          deliveryCompanyId: companyId,
          amountCoins,
          reason: adjustReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Adjustment failed");
        return;
      }
      setMessage(
        `Updated balance: ${Number(data.balanceAfter ?? 0).toFixed(2)} coins (${amountCoins >= 0 ? "+" : ""}${amountCoins.toFixed(2)})`,
      );
      setAdjustAmount("");
      setAdjustReason("");
      await loadCompanies();
      await loadAudit();
    } finally {
      setAdjustBusy(false);
    }
  };

  const selected = companies.find((c) => c.id === companyId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Delivery company budgets & wallet</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {showFinanceAdjust ? (
            <>
              Approve department budget requests and add or withdraw coins from a company&apos;s main wallet
              (audited).
            </>
          ) : (
            <>Review and approve department budget requests for companies in your scope (audited).</>
          )}
        </p>
      </div>

      {message && (
        <div className="rounded-md border bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{message}</div>
      )}

      {showFinanceAdjust && (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="text-lg font-medium">Company wallet (main balance)</h2>
          <p className="text-xs text-muted-foreground">
            Positive amount adds coins; negative operation withdraws from <strong>available</strong> balance (total
            minus locked order reserves). Requires Idempotency-Key per request — handled automatically.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              <span>Company</span>
              <select
                className="rounded-md border bg-background px-2 py-2"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">— Select —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Amount (coins)</span>
              <input
                className="rounded-md border bg-background px-2 py-2"
                inputMode="decimal"
                placeholder="e.g. 100"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span>Reason (optional)</span>
              <input
                className="rounded-md border bg-background px-2 py-2"
                placeholder="Shown in audit and company notification"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </label>
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">
              Current main balance: {Number(selected.coinBalance ?? 0).toFixed(2)} · Locked:{" "}
              {Number(selected.lockedCoins ?? 0).toFixed(2)} · Available:{" "}
              {(Number(selected.coinBalance ?? 0) - Number(selected.lockedCoins ?? 0)).toFixed(2)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={adjustBusy}
              onClick={() => void submitAdjust(1)}
            >
              Add coins
            </button>
            <button
              type="button"
              className="rounded-md border border-destructive text-destructive px-3 py-2 text-sm disabled:opacity-50"
              disabled={adjustBusy}
              onClick={() => void submitAdjust(-1)}
            >
              Withdraw coins
            </button>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Finance adjustment audit</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-2">When</th>
                <th className="p-2">Company</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-muted-foreground">
                    No finance adjustments yet.
                  </td>
                </tr>
              ) : (
                audit.map((a) => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="p-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="p-2">{a.deliveryCompany?.name || "—"}</td>
                    <td className="p-2">
                      {a.actorType}
                      {a.actorRef ? ` · ${a.actorRef.slice(0, 8)}…` : ""}
                    </td>
                    <td className="p-2 max-w-md truncate font-mono text-xs">
                      {typeof a.details === "object" && a.details !== null
                        ? JSON.stringify(a.details)
                        : String(a.details ?? "")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-medium">Department budget requests</h2>
          <label className="flex flex-col gap-1 text-sm sm:min-w-[220px]">
            <span className="text-muted-foreground">Filter by company</span>
            <select
              className="rounded-md border bg-background px-2 py-2"
              value={budgetFilterCompanyId}
              onChange={(e) => setBudgetFilterCompanyId(e.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {groupedBudgetRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budget requests.</p>
        ) : (
          <div className="space-y-6">
            {groupedBudgetRows.map(([cid, group]) => (
              <div key={cid} className="rounded-lg border bg-card">
                <div className="border-b bg-muted/40 px-3 py-2 font-medium">{group.companyName}</div>
                <div className="space-y-2 p-3">
                  {group.rows.map((r) => (
                    <div key={r.id} className="rounded-md border bg-background p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{r.department?.label || "Department"}</span>
                        <span>{r.status}</span>
                      </div>
                      <p>
                        {Number(r.amountCoins || 0).toFixed(2)} coins — {r.priority}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.department?.isMainDepartment ? "Main department" : "Department"}{" "}
                        · {new Date(r.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.decisionNote || "—"}</p>
                      {r.status === "PENDING" && (
                        <div className="mt-2 flex gap-2">
                          <button
                            className="rounded-md border px-2 py-1 text-xs"
                            onClick={() => update(r.id, "APPROVED")}
                          >
                            Approve
                          </button>
                          <button
                            className="rounded-md border px-2 py-1 text-xs"
                            onClick={() => update(r.id, "REJECTED")}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
