"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildIdempotencyKey } from "@/lib/idempotency";

type Department = { id: string; label: string; isMainDepartment?: boolean };
type DepartmentAccount = {
  id: string;
  email: string;
  role: string;
  department?: { id: string; label: string; isMainDepartment?: boolean };
};
type Policy = {
  id: string;
  departmentAccountId: string;
  maxAutoApproveAmount: string | number;
  minHoursBetweenReq: number;
  isAutoApproveEnabled: boolean;
  departmentAccount?: {
    id: string;
    email: string;
    department?: Department;
  };
};
type BudgetScheduleRow = {
  id: string;
  departmentAccountId: string;
  amountCoins: string | number;
  cadence: string;
  nextRunAt: string;
  lastRunAt?: string | null;
  isActive: boolean;
  departmentAccount?: {
    id: string;
    email: string;
    department?: Department;
  };
};
type RequestRow = {
  id: string;
  departmentId: string;
  amountCoins: string | number;
  priority: string;
  status: string;
  createdAt: string;
  department?: Department;
  requestedByAccount?: { id: string; email: string } | null;
};
type LedgerRow = {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description?: string | null;
  createdAt: string;
};
type DeptWalletRow = {
  id: string;
  availableCoins: string;
  lockedCoins: string;
  department?: { id: string; label: string; isMainDepartment?: boolean };
};

function CompanyBudgetsPageContent() {
  const searchParams = useSearchParams();
  const highlightRequest = searchParams.get("highlightRequest");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentAccounts, setDepartmentAccounts] = useState<DepartmentAccount[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [policyAccountId, setPolicyAccountId] = useState("");
  const [maxAutoApproveAmount, setMaxAutoApproveAmount] = useState("0");
  const [minHoursBetweenReq, setMinHoursBetweenReq] = useState("0");
  const [isAutoApproveEnabled, setIsAutoApproveEnabled] = useState(false);
  const [requestAmount, setRequestAmount] = useState("50");
  const [priority, setPriority] = useState("NORMAL");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actorRole, setActorRole] = useState<string>("MAIN_ADMIN");
  const [transferDepartmentAccountId, setTransferDepartmentAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("50");
  const [companyLedger, setCompanyLedger] = useState<LedgerRow[]>([]);
  const [deptWallets, setDeptWallets] = useState<DeptWalletRow[]>([]);
  const [schedules, setSchedules] = useState<BudgetScheduleRow[]>([]);
  const [scheduleAccountId, setScheduleAccountId] = useState("");
  const [scheduleAmount, setScheduleAmount] = useState("100");
  const [scheduleCadence, setScheduleCadence] = useState("MONTHLY");
  const isMain = actorRole === "MAIN_ADMIN";

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const me = await fetch("/api/company-auth/me")
        .then((x) => x.json())
        .catch(() => null);
      if (me?.actorRole) setActorRole(String(me.actorRole));
      const mainUser = (me?.actorRole || "MAIN_ADMIN") === "MAIN_ADMIN";

      const [dep, pol, reqs, accRes, schedRes] = await Promise.all([
        fetch("/api/company/departments").then((x) => x.json()),
        fetch("/api/company/budget-policies").then((x) => x.json()),
        fetch("/api/company/budget-requests").then((x) => x.json()),
        fetch("/api/company/department-accounts"),
        mainUser ? fetch("/api/company/budget-schedules") : Promise.resolve({ ok: false } as Response),
      ]);
      const accData = accRes.ok ? await accRes.json() : [];
      const deps = Array.isArray(dep) ? dep : [];
      setDepartments(deps);
      const accounts = Array.isArray(accData) ? accData : [];
      setDepartmentAccounts(accounts);
      if (!policyAccountId && accounts.length > 0) setPolicyAccountId(accounts[0].id);
      const transferable = accounts.filter(
        (a: DepartmentAccount) => a.department && !a.department.isMainDepartment,
      );
      if (!transferDepartmentAccountId && transferable.length > 0) {
        setTransferDepartmentAccountId(transferable[0].id);
      }
      if (mainUser) {
        if (schedRes.ok) {
          const s = await schedRes.json();
          setSchedules(Array.isArray(s) ? s : []);
          if (!scheduleAccountId && transferable.length > 0) setScheduleAccountId(transferable[0].id);
        } else {
          setSchedules([]);
        }
      } else {
        setSchedules([]);
      }
      setPolicies(Array.isArray(pol) ? pol : []);
      setRequests(Array.isArray(reqs) ? reqs : []);

      if (mainUser) {
        const [ledgerRes, walletsRes] = await Promise.all([
          fetch("/api/company/company-ledger"),
          fetch("/api/company/department-budget-wallets"),
        ]);
        setCompanyLedger(ledgerRes.ok ? await ledgerRes.json() : []);
        setDeptWallets(walletsRes.ok ? await walletsRes.json() : []);
      } else {
        setCompanyLedger([]);
        setDeptWallets([]);
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!highlightRequest) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`budget-req-${highlightRequest}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightRequest, requests]);

  const savePolicy = async () => {
    setMessage(null);
    const res = await fetch("/api/company/budget-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentAccountId: policyAccountId,
        maxAutoApproveAmount: Number(maxAutoApproveAmount || 0),
        minHoursBetweenReq: Number(minHoursBetweenReq || 0),
        isAutoApproveEnabled,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to save policy");
    setMessage("Budget policy saved.");
    await load();
  };

  const createRequest = async () => {
    setMessage(null);
    const payload = {
      amountCoins: Number(requestAmount || 0),
      priority,
    };
    const idemKey = buildIdempotencyKey("company-budget-request-create", payload);
    const res = await fetch("/api/company/budget-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idemKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to create budget request");
    setMessage(
      data?.status === "PENDING"
        ? "Budget request submitted and pending review."
        : `Budget request processed (${String(data.status)}).`,
    );
    await load();
  };

  const transferCoins = async () => {
    setMessage(null);
    const res = await fetch("/api/company/budget-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentAccountId: transferDepartmentAccountId,
        amountCoins: Number(transferAmount || 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to transfer coins");
    setMessage("Coins sent successfully.");
    await load();
  };

  const createSchedule = async () => {
    setMessage(null);
    const res = await fetch("/api/company/budget-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentAccountId: scheduleAccountId,
        amountCoins: Number(scheduleAmount || 0),
        cadence: scheduleCadence,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to create schedule");
    setMessage("Scheduled transfer saved.");
    await load();
  };

  const patchSchedule = async (id: string, patch: Record<string, unknown>) => {
    setMessage(null);
    const res = await fetch(`/api/company/budget-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to update schedule");
    setMessage("Schedule updated.");
    await load();
  };

  const deleteSchedule = async (id: string) => {
    if (!window.confirm("Delete this scheduled transfer?")) return;
    setMessage(null);
    const res = await fetch(`/api/company/budget-schedules/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to delete schedule");
    setMessage("Schedule removed.");
    await load();
  };

  const decide = async (id: string, decision: "APPROVE" | "REJECT") => {
    setMessage(null);
    const idemKey = buildIdempotencyKey("company-budget-request-decision", { id, decision });
    const res = await fetch(`/api/company/budget-requests/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to apply decision");
    setMessage(`Request ${decision.toLowerCase()}d.`);
    await load();
  };

  if (loading) return <div>Loading budget controls...</div>;

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const settledRequests = requests.filter((r) => r.status !== "PENDING");

  const renderRequestRow = (r: RequestRow, pendingStyle: boolean) => (
    <div
      key={r.id}
      id={`budget-req-${r.id}`}
      className={
        pendingStyle
          ? "rounded-lg border-2 border-amber-500/80 bg-amber-500/10 p-4 text-sm shadow-sm dark:border-amber-400/60 dark:bg-amber-500/15"
          : "rounded-md border border-border bg-card p-3 text-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {pendingStyle && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold uppercase text-white dark:bg-amber-600">
                Action required
              </span>
            )}
            <span className="font-medium">{r.department?.label || r.departmentId}</span>
            {r.requestedByAccount?.email && (
              <span className="text-xs text-muted-foreground">({r.requestedByAccount.email})</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Amount: {Number(r.amountCoins || 0).toFixed(2)} coins · Priority:{" "}
            <span className={r.priority === "URGENT" ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>{r.priority}</span>
          </p>
        </div>
        <span
          className={
            r.status === "PENDING"
              ? "shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/80 dark:text-amber-100"
              : "shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium"
          }
        >
          {r.status}
        </span>
      </div>
      {isMain && r.status === "PENDING" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-600/20 dark:text-green-100"
            onClick={() => decide(r.id, "APPROVE")}
          >
            Approve
          </button>
          <button
            type="button"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
            onClick={() => decide(r.id, "REJECT")}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      {isMain && (
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Budget policy (per department account)</h2>
        <p className="text-xs text-muted-foreground">
          Policies apply to one login account. Only <strong className="font-medium">Urgent</strong> on-demand requests can be auto-approved when the max amount, cooldown, and auto-approve toggle match. Recurring top-ups use scheduled transfers below.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="budget-policy-account" className="text-xs font-medium text-foreground">
              Department account
            </label>
            <select
              id="budget-policy-account"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={policyAccountId}
              onChange={(e) => setPolicyAccountId(e.target.value)}
            >
              <option value="">Choose account…</option>
              {departmentAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email} — {a.department?.label || "Dept"}{a.department?.isMainDepartment ? " (Main)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="budget-policy-max-auto" className="text-xs font-medium text-foreground">
              Max auto-approved amount (coins)
            </label>
            <input
              id="budget-policy-max-auto"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              type="number"
              min="0"
              step="0.1"
              value={maxAutoApproveAmount}
              onChange={(e) => setMaxAutoApproveAmount(e.target.value)}
              placeholder="Urgent requests above this need manual approval"
              aria-label="Maximum coins for automatic approval of urgent requests"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="budget-policy-min-hours" className="text-xs font-medium text-foreground">
              Minimum hours between urgent requests
            </label>
            <input
              id="budget-policy-min-hours"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              type="number"
              min="0"
              value={minHoursBetweenReq}
              onChange={(e) => setMinHoursBetweenReq(e.target.value)}
              placeholder="Cooldown between Urgent submissions from this account"
              aria-label="Minimum hours between urgent budget requests"
            />
          </div>
          <div className="flex flex-col justify-end space-y-1.5 md:col-span-2">
            <span className="text-xs font-medium text-foreground">Auto-approve urgent requests</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={isAutoApproveEnabled}
                onChange={(e) => setIsAutoApproveEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span>When enabled, matching <strong className="font-medium">Urgent</strong> requests within the max amount can be funded automatically.</span>
            </label>
          </div>
        </div>
        <button className="rounded-md border px-3 py-2" onClick={savePolicy}>Save policy</button>
      </section>
      )}

      {!isMain && (
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Budget Request</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input className="rounded-md border px-3 py-2" type="number" min="1" step="0.1" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} placeholder="Amount in coins" />
          <select className="rounded-md border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
          </select>
          <button className="rounded-md border px-3 py-2" onClick={createRequest}>Create request</button>
        </div>
      </section>
      )}

      {isMain && (
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Scheduled transfers (recurring)</h2>
        <p className="text-xs text-muted-foreground">
          Automatically send coins to a department account on each period (daily / weekly / monthly). The run checks your company available balance. If funds are short, you get an inbox reminder within ~24h before the next run. Configure a system cron to call{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">POST /api/cron/scheduled-budget-transfers</code> with header{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">Authorization: Bearer $CRON_SECRET</code>.
        </p>
        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={scheduleAccountId}
            onChange={(e) => setScheduleAccountId(e.target.value)}
            aria-label="Department account for schedule"
          >
            <option value="">Department account</option>
            {departmentAccounts
              .filter((a) => a.department && !a.department.isMainDepartment)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email} — {a.department?.label || "Dept"}
                </option>
              ))}
          </select>
          <input
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            type="number"
            min="0.1"
            step="0.1"
            value={scheduleAmount}
            onChange={(e) => setScheduleAmount(e.target.value)}
            placeholder="Amount (coins)"
            aria-label="Scheduled amount in coins"
          />
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={scheduleCadence}
            onChange={(e) => setScheduleCadence(e.target.value)}
            aria-label="Cadence"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <button type="button" className="rounded-md border px-3 py-2" onClick={createSchedule}>
            Add schedule
          </button>
        </div>
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div>
                <span className="font-medium">{s.departmentAccount?.email || s.departmentAccountId}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {Number(s.amountCoins || 0).toFixed(2)} coins · {s.cadence}
                </span>
                <p className="text-xs text-muted-foreground">
                  Next: {new Date(s.nextRunAt).toLocaleString()}
                  {s.lastRunAt ? ` · Last: ${new Date(s.lastRunAt).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => patchSchedule(s.id, { isActive: !s.isActive })}
                >
                  {s.isActive ? "Pause" : "Resume"}
                </button>
                <button type="button" className="rounded border border-destructive/40 px-2 py-1 text-xs text-destructive" onClick={() => deleteSchedule(s.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {schedules.length === 0 && <p className="text-sm text-muted-foreground">No recurring schedules yet.</p>}
        </div>
      </section>
      )}

      {isMain && (
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Send Coins to Department Account</h2>
        <p className="text-xs text-muted-foreground">
          Coins are credited to that account&apos;s department budget wallet (child departments only; main department uses the company wallet).
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className="rounded-md border px-3 py-2"
            value={transferDepartmentAccountId}
            onChange={(e) => setTransferDepartmentAccountId(e.target.value)}
          >
            <option value="">Select department account</option>
            {departmentAccounts
              .filter((a) => a.department && !a.department.isMainDepartment)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email} — {a.department?.label || "Department"}
                </option>
              ))}
          </select>
          <input className="rounded-md border px-3 py-2" type="number" min="1" step="0.1" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="Amount in coins" />
          <button className="rounded-md border px-3 py-2" onClick={transferCoins}>Send coins</button>
        </div>
      </section>
      )}

      {isMain && (
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Active Policies</h2>
        <div className="space-y-2">
          {policies.map((p) => (
            <div key={p.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {p.departmentAccount?.email || p.departmentAccountId}
                  {p.departmentAccount?.department?.label ? ` · ${p.departmentAccount.department.label}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">Urgent auto-approve</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto (urgent): {p.isAutoApproveEnabled ? "On" : "Off"} | Max: {Number(p.maxAutoApproveAmount || 0).toFixed(2)} | Min between urgent requests: {p.minHoursBetweenReq}h
              </p>
            </div>
          ))}
          {policies.length === 0 && <p className="text-sm text-muted-foreground">No policies yet.</p>}
        </div>
      </section>
      )}

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Budget requests</h2>
        {isMain ? (
          <>
            {pendingRequests.length > 0 && (
              <div className="mb-6 space-y-3">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Pending review ({pendingRequests.length})
                </h3>
                <div className="space-y-3">{pendingRequests.map((r) => renderRequestRow(r, true))}</div>
              </div>
            )}
            {settledRequests.length > 0 && (
              <div className="space-y-2">
                {pendingRequests.length > 0 && (
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Other history</h3>
                )}
                {settledRequests.map((r) => renderRequestRow(r, false))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => renderRequestRow(r, r.status === "PENDING"))}
          </div>
        )}
        {requests.length === 0 && <p className="text-sm text-muted-foreground">No budget requests yet.</p>}
      </section>

      {isMain && deptWallets.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Department budget balances</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Available</th>
                  <th className="py-2">Locked</th>
                </tr>
              </thead>
              <tbody>
                {deptWallets.map((w) => (
                  <tr key={w.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{w.department?.label || "—"}</td>
                    <td className="py-2 pr-4">{Number(w.availableCoins || 0).toFixed(2)}</td>
                    <td className="py-2">{Number(w.lockedCoins || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isMain && companyLedger.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-1 text-lg font-semibold">Company coin ledger</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            All company wallet movements (transfers to departments, budget allocations, orders, etc.).
          </p>
          <div className="max-h-96 overflow-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Balance after</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {companyLedger.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{row.type}</td>
                    <td className="px-3 py-1.5">{Number(row.amount).toFixed(2)}</td>
                    <td className="px-3 py-1.5">{Number(row.balanceAfter).toFixed(2)}</td>
                    <td className="max-w-[240px] truncate px-3 py-1.5 text-xs text-muted-foreground" title={row.description || ""}>
                      {row.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default function CompanyBudgetsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading budgets…</div>}>
      <CompanyBudgetsPageContent />
    </Suspense>
  );
}
