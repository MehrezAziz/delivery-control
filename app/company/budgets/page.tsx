"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  decisionNote?: string | null;
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

function budgetRequestStatusBadgeClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-50 dark:ring-amber-600/50";
    case "AUTO_APPROVED":
      return "bg-sky-100 text-sky-950 ring-1 ring-sky-300/60 dark:bg-sky-950/45 dark:text-sky-50 dark:ring-sky-600/40";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300/60 dark:bg-emerald-950/45 dark:text-emerald-50 dark:ring-emerald-600/40";
    case "REJECTED":
      return "bg-red-100 text-red-950 ring-1 ring-red-300/60 dark:bg-red-950/40 dark:text-red-50 dark:ring-red-600/40";
    case "CANCELLED":
      return "bg-slate-200 text-slate-800 ring-1 ring-slate-300/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600/50";
    default:
      return "bg-muted text-foreground";
  }
}

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
  const [scheduleDraft, setScheduleDraft] = useState<{
    id: string;
    amount: string;
    cadence: string;
    nextRunAt: string;
  } | null>(null);
  const [requestSort, setRequestSort] = useState<
    "createdAt-desc" | "createdAt-asc" | "amount-desc" | "amount-asc" | "priority" | "status"
  >("createdAt-desc");
  const [meDepartmentAccountId, setMeDepartmentAccountId] = useState<string | null>(null);
  const [requestEditDraft, setRequestEditDraft] = useState<{ id: string; amount: string; priority: string } | null>(
    null,
  );
  const [recallAccountId, setRecallAccountId] = useState("");
  const [recallAmount, setRecallAmount] = useState("50");
  const [mainCompanyWallet, setMainCompanyWallet] = useState<{
    balance: number;
    availableCapacity: number;
  } | null>(null);
  const [departmentAccountsError, setDepartmentAccountsError] = useState<string | null>(null);
  const isMain = actorRole === "MAIN_ADMIN";

  /** Send / recall / schedules credit child-department wallets only (not the main department). */
  const childDepartmentAccounts = useMemo(
    () => departmentAccounts.filter((a) => a.department && !a.department.isMainDepartment),
    [departmentAccounts],
  );
  const canEditOwnBudgetRequest =
    !isMain && (actorRole === "DEPT_ADMIN" || actorRole === "DEPT_OPERATOR");

  const refreshBudgetRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/company/budget-requests", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setRequests(data);
    } catch {
      /* ignore */
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const me = await fetch("/api/company-auth/me")
        .then((x) => x.json())
        .catch(() => null);
      if (me?.actorRole) setActorRole(String(me.actorRole));
      if (me?.departmentAccountId) setMeDepartmentAccountId(String(me.departmentAccountId));
      else setMeDepartmentAccountId(null);
      const mainUser = (me?.actorRole || "MAIN_ADMIN") === "MAIN_ADMIN";

      const [dep, polRes, reqs, accRes, schedRes] = await Promise.all([
        fetch("/api/company/departments").then((x) => x.json()),
        fetch("/api/company/budget-policies"),
        fetch("/api/company/budget-requests", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/company/department-accounts", { cache: "no-store" }),
        mainUser ? fetch("/api/company/budget-schedules") : Promise.resolve({ ok: false } as Response),
      ]);
      const pol = polRes.ok ? await polRes.json() : [];
      const accJson = await accRes.json().catch(() => null);
      const deps = Array.isArray(dep) ? dep : [];
      setDepartments(deps);
      let accounts: DepartmentAccount[] = [];
      if (!accRes.ok) {
        setDepartmentAccountsError(
          typeof accJson?.error === "string" ? accJson.error : `Failed to load department accounts (${accRes.status})`,
        );
        setDepartmentAccounts([]);
      } else {
        setDepartmentAccountsError(null);
        accounts = Array.isArray(accJson) ? accJson : [];
        setDepartmentAccounts(accounts);
      }
      if (!policyAccountId && accounts.length > 0) setPolicyAccountId(accounts[0].id);
      const transferable = accounts.filter(
        (a: DepartmentAccount) => a.department && !a.department.isMainDepartment,
      );
      if (!transferDepartmentAccountId && transferable.length > 0) {
        setTransferDepartmentAccountId(transferable[0].id);
      }
      if (!recallAccountId && transferable.length > 0) {
        setRecallAccountId(transferable[0].id);
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
        const [ledgerRes, walletsRes, walletMainRes] = await Promise.all([
          fetch("/api/company/company-ledger"),
          fetch("/api/company/department-budget-wallets"),
          fetch("/api/company/wallet"),
        ]);
        setCompanyLedger(ledgerRes.ok ? await ledgerRes.json() : []);
        setDeptWallets(walletsRes.ok ? await walletsRes.json() : []);
        if (walletMainRes.ok) {
          const w = await walletMainRes.json();
          setMainCompanyWallet({
            balance: Number(w.balance ?? 0),
            availableCapacity: Number(w.availableCapacity ?? 0),
          });
        } else {
          setMainCompanyWallet(null);
        }
      } else {
        setCompanyLedger([]);
        setDeptWallets([]);
        setMainCompanyWallet(null);
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

  /** Near–realtime: poll while tab visible + refresh when company notifications update (e.g. websocket). */
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refreshBudgetRequests();
    }, 6000);
    function onCompanyNotifRefresh() {
      void refreshBudgetRequests();
    }
    window.addEventListener("dc-company-notifications-refresh", onCompanyNotifRefresh);
    return () => {
      clearInterval(poll);
      window.removeEventListener("dc-company-notifications-refresh", onCompanyNotifRefresh);
    };
  }, [refreshBudgetRequests]);

  useEffect(() => {
    if (!isMain || !policyAccountId) return;
    const p = policies.find((x) => x.departmentAccountId === policyAccountId);
    if (p) {
      setMaxAutoApproveAmount(String(p.maxAutoApproveAmount ?? 0));
      setMinHoursBetweenReq(String(p.minHoursBetweenReq ?? 0));
      setIsAutoApproveEnabled(!!p.isAutoApproveEnabled);
    } else {
      setMaxAutoApproveAmount("0");
      setMinHoursBetweenReq("0");
      setIsAutoApproveEnabled(false);
    }
  }, [isMain, policyAccountId, policies]);

  useEffect(() => {
    if (!isMain || departmentAccounts.length === 0) return;
    if (policyAccountId && departmentAccounts.some((a) => a.id === policyAccountId)) return;
    setPolicyAccountId(departmentAccounts[0].id);
  }, [isMain, departmentAccounts, policyAccountId]);

  useEffect(() => {
    if (!highlightRequest) return;
    let cancelled = false;
    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(`budget-req-${highlightRequest}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2800);
    };
    requestAnimationFrame(tryScroll);
    const t1 = window.setTimeout(tryScroll, 200);
    const t2 = window.setTimeout(tryScroll, 700);
    const t3 = window.setTimeout(tryScroll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [highlightRequest, requests]);

  const deletePolicy = async (policyId: string) => {
    if (!window.confirm("Remove this budget policy for the account? You can add it again later.")) return;
    setMessage(null);
    const res = await fetch(`/api/company/budget-policies/${policyId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to delete policy");
    setMessage("Policy removed.");
    await load();
  };

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
    // Fresh key each submit — deterministic keys caused duplicate payloads (e.g. default 50 + NORMAL) to replay cached responses without inserting rows.
    const idemKey = `company-budget-request-create_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`}`;
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
    const isUrgentRow = String(data?.priority ?? "").toUpperCase() === "URGENT";
    const note = data?.decisionNote ? String(data.decisionNote) : "";
    setMessage(
      data?.status === "PENDING"
        ? isUrgentRow && note
          ? `Not auto-approved: ${note}`
          : "Budget request submitted and pending review."
        : `Budget request processed (${String(data.status)}).`,
    );
    await refreshBudgetRequests();
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

  const toDatetimeLocalInput = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    setScheduleDraft(null);
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

  const saveBudgetRequestEdit = async (requestId: string) => {
    if (!requestEditDraft || requestEditDraft.id !== requestId) return;
    setMessage(null);
    const res = await fetch(`/api/company/budget-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCoins: Number(requestEditDraft.amount || 0),
        priority: requestEditDraft.priority,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to update request");
    setRequestEditDraft(null);
    setMessage("Budget request updated.");
    void refreshBudgetRequests();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dc-company-notifications-refresh"));
    }
  };

  const cancelOwnPendingRequest = async (requestId: string) => {
    if (!window.confirm("Cancel this budget request? Main company has not decided yet.")) return;
    setMessage(null);
    const res = await fetch(`/api/company/budget-requests/${requestId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to cancel request");
    setRequestEditDraft(null);
    setMessage("Budget request cancelled.");
    void refreshBudgetRequests();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dc-company-notifications-refresh"));
    }
  };

  const recallBudgetCoins = async () => {
    setMessage(null);
    const res = await fetch("/api/company/budget-recall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentAccountId: recallAccountId,
        amountCoins: Number(recallAmount || 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to recall coins");
    setMessage("Coins recalled from department budget to company wallet.");
    await load();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dc-company-notifications-refresh"));
    }
  };

  const sortedRequests = useMemo(() => {
    const copy = [...requests];
    const byDate = (a: RequestRow, b: RequestRow) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const byAmount = (a: RequestRow, b: RequestRow) =>
      Number(a.amountCoins || 0) - Number(b.amountCoins || 0);
    const prioRank = (p: string) => (p === "URGENT" ? 0 : 1);
    const statusRank = (s: string) => {
      if (s === "PENDING") return 0;
      if (s === "AUTO_APPROVED" || s === "APPROVED") return 1;
      return 2;
    };
    switch (requestSort) {
      case "createdAt-desc":
        copy.sort((a, b) => -byDate(a, b));
        break;
      case "createdAt-asc":
        copy.sort(byDate);
        break;
      case "amount-desc":
        copy.sort((a, b) => -byAmount(a, b));
        break;
      case "amount-asc":
        copy.sort(byAmount);
        break;
      case "priority":
        copy.sort((a, b) => prioRank(a.priority) - prioRank(b.priority) || -byDate(a, b));
        break;
      case "status":
        copy.sort((a, b) => statusRank(a.status) - statusRank(b.status) || -byDate(a, b));
        break;
      default:
        break;
    }
    return copy;
  }, [requests, requestSort]);

  /** Department budget wallet for each non-main department account (by account id). */
  const deptWalletByAccountId = useMemo(() => {
    const m = new Map<string, { available: number; locked: number }>();
    for (const acc of departmentAccounts) {
      const deptId = acc.department?.id;
      if (!deptId || acc.department?.isMainDepartment) continue;
      const w = deptWallets.find((row) => row.department?.id === deptId);
      m.set(acc.id, {
        available: w ? Number(w.availableCoins || 0) : 0,
        locked: w ? Number(w.lockedCoins || 0) : 0,
      });
    }
    return m;
  }, [departmentAccounts, deptWallets]);

  const pendingRequests = sortedRequests.filter((r) => r.status === "PENDING");
  const settledRequests = sortedRequests.filter((r) => r.status !== "PENDING");

  if (loading) return <div>Loading budget controls...</div>;

  const selectedDeptBudgetHint = (accountId: string) => {
    if (!accountId) {
      return (
        <p className="text-xs text-muted-foreground">Select a department account to see its current budget wallet balance.</p>
      );
    }
    const snap = deptWalletByAccountId.get(accountId);
    const av = snap?.available ?? 0;
    const lk = snap?.locked ?? 0;
    return (
      <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Current department budget · </span>
        <span className="font-semibold tabular-nums text-foreground">{av.toFixed(2)}</span>
        <span className="text-muted-foreground"> coins available</span>
        {lk > 0 ? (
          <span className="text-muted-foreground">
            {" "}
            · {lk.toFixed(2)} locked
          </span>
        ) : null}
      </p>
    );
  };

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
          {r.priority === "URGENT" && r.status === "PENDING" && r.decisionNote && (
            <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-50">
              <span className="font-medium">Why not auto-approved: </span>
              {r.decisionNote}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${budgetRequestStatusBadgeClass(r.status)}`}
          title={r.status.replace(/_/g, " ")}
        >
          {r.status.replace(/_/g, " ")}
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
      {!isMain &&
        r.status === "PENDING" &&
        canEditOwnBudgetRequest &&
        meDepartmentAccountId &&
        r.requestedByAccount?.id === meDepartmentAccountId && (
          <div className="mt-3 space-y-2">
            {requestEditDraft?.id === r.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Amount (coins)</span>
                  <input
                    className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={requestEditDraft.amount}
                    onChange={(e) =>
                      setRequestEditDraft((d) => (d?.id === r.id ? { ...d, amount: e.target.value } : d))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Priority</span>
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={requestEditDraft.priority}
                    onChange={(e) =>
                      setRequestEditDraft((d) => (d?.id === r.id ? { ...d, priority: e.target.value } : d))
                    }
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium"
                  onClick={() => void saveBudgetRequestEdit(r.id)}
                >
                  Save changes
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-xs"
                  onClick={() => setRequestEditDraft(null)}
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium"
                  onClick={() =>
                    setRequestEditDraft({
                      id: r.id,
                      amount: String(r.amountCoins ?? ""),
                      priority: r.priority || "NORMAL",
                    })
                  }
                >
                  Edit amount / priority
                </button>
                <button
                  type="button"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"
                  onClick={() => void cancelOwnPendingRequest(r.id)}
                >
                  Cancel request
                </button>
              </div>
            )}
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
          Policies apply to one login account. <strong className="font-medium">Urgent</strong> requests are auto-approved when the toggle is on, company balance is enough, and the rolling total of urgent requests (same account, excluding rejected/cancelled) in the last <em>N</em> hours does not exceed the cap — set <em>N</em> with &quot;Rolling window (hours)&quot;. Recurring top-ups use scheduled transfers below.
        </p>
        {departmentAccountsError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load department accounts: {departmentAccountsError}
          </p>
        )}
        {!departmentAccountsError && departmentAccounts.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            No department login accounts yet. Create them under <strong className="text-foreground">Company → Departments</strong> (add users for each department).
          </p>
        )}
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
              Max urgent total (coins) in rolling window
            </label>
            <input
              id="budget-policy-max-auto"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              type="number"
              min="0"
              step="0.1"
              value={maxAutoApproveAmount}
              onChange={(e) => setMaxAutoApproveAmount(e.target.value)}
              placeholder="Sum of urgent amounts in the window must stay ≤ this"
              aria-label="Maximum total urgent coins per rolling window"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="budget-policy-min-hours" className="text-xs font-medium text-foreground">
              Rolling window (hours) for urgent total
            </label>
            <input
              id="budget-policy-min-hours"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              type="number"
              min="0"
              value={minHoursBetweenReq}
              onChange={(e) => setMinHoursBetweenReq(e.target.value)}
              placeholder="0 = only per-request cap (no rolling sum over time)"
              aria-label="Hours over which urgent request amounts are summed"
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
              <span>When enabled, <strong className="font-medium">Urgent</strong> requests are funded automatically if the rolling sum rules and company balance allow it.</span>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-md border px-3 py-2" onClick={savePolicy}>
            Save policy
          </button>
        </div>
      </section>
      )}

      {!isMain && policies.length > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="text-lg font-semibold">Your budget policy (read-only)</h2>
          <p className="text-xs text-muted-foreground">
            Main company configures this. Urgent requests auto-approve only when these rules and the company balance allow it.
          </p>
          {policies.map((p) => (
            <div key={p.id} className="rounded-md border bg-muted/30 p-3 text-sm">
              <p>
                Urgent auto-approve: <strong>{p.isAutoApproveEnabled ? "On" : "Off"}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Max urgent total in rolling window: {Number(p.maxAutoApproveAmount || 0).toFixed(2)} coins · Window: {p.minHoursBetweenReq}h
              </p>
            </div>
          ))}
        </section>
      )}

      {!isMain && policies.length === 0 && (
        <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No budget policy is configured for your login yet. Urgent requests will stay pending until main company approves them.
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
        {departmentAccounts.length > 0 && childDepartmentAccounts.length === 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
            Scheduled transfers only apply to accounts tied to a <strong>non-main</strong> department. Your department logins are all on the main department — add another department under{" "}
            <strong>Company → Departments</strong>, then create a department account for it.
          </p>
        )}
        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={scheduleAccountId}
            onChange={(e) => setScheduleAccountId(e.target.value)}
            aria-label="Department account for schedule"
          >
            <option value="">Department account</option>
            {childDepartmentAccounts.map((a) => (
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
            <div key={s.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                    onClick={() =>
                      setScheduleDraft(
                        scheduleDraft?.id === s.id
                          ? null
                          : {
                              id: s.id,
                              amount: String(s.amountCoins),
                              cadence: s.cadence,
                              nextRunAt: toDatetimeLocalInput(s.nextRunAt),
                            },
                      )
                    }
                  >
                    {scheduleDraft?.id === s.id ? "Close edit" : "Edit"}
                  </button>
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
              {scheduleDraft?.id === s.id && (
                <div className="mt-3 grid gap-2 border-t border-border pt-3 md:grid-cols-4">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={scheduleDraft.amount}
                    onChange={(e) => setScheduleDraft((d) => (d ? { ...d, amount: e.target.value } : d))}
                    aria-label="Edit scheduled amount"
                  />
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={scheduleDraft.cadence}
                    onChange={(e) => setScheduleDraft((d) => (d ? { ...d, cadence: e.target.value } : d))}
                    aria-label="Edit cadence"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                  <input
                    type="datetime-local"
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={scheduleDraft.nextRunAt}
                    onChange={(e) => setScheduleDraft((d) => (d ? { ...d, nextRunAt: e.target.value } : d))}
                    aria-label="Next run at"
                  />
                  <button
                    type="button"
                    className="rounded-md border px-2 py-1.5 text-sm"
                    onClick={() =>
                      patchSchedule(scheduleDraft.id, {
                        amountCoins: Number(scheduleDraft.amount || 0),
                        cadence: scheduleDraft.cadence,
                        nextRunAt: new Date(scheduleDraft.nextRunAt).toISOString(),
                      })
                    }
                  >
                    Save changes
                  </button>
                </div>
              )}
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
        {departmentAccounts.length > 0 && childDepartmentAccounts.length === 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
            Transfers target <strong>non-main</strong> departments only. Add a second department and a login for it, or move a user off the main department, to see options here.
          </p>
        )}
        {selectedDeptBudgetHint(transferDepartmentAccountId)}
        {mainCompanyWallet && (
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Main company wallet (bWallet) · </span>
            <span className="font-semibold tabular-nums text-foreground">{mainCompanyWallet.balance.toFixed(2)}</span>
            <span className="text-muted-foreground"> coins balance · </span>
            <span className="font-semibold tabular-nums text-foreground">{mainCompanyWallet.availableCapacity.toFixed(2)}</span>
            <span className="text-muted-foreground"> available capacity</span>
          </p>
        )}
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className="rounded-md border px-3 py-2"
            value={transferDepartmentAccountId}
            onChange={(e) => setTransferDepartmentAccountId(e.target.value)}
          >
            <option value="">Select department account</option>
            {childDepartmentAccounts.map((a) => (
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
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Recall coins from department budget</h2>
        <p className="text-xs text-muted-foreground">
          Move coins from a department&apos;s budget wallet back to the company wallet at any time. The department account receives a notification; the company ledger records the return (department budget decreases, company balance increases).
        </p>
        {departmentAccounts.length > 0 && childDepartmentAccounts.length === 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
            Recall applies to <strong>non-main</strong> department budget wallets. Add a child department and a department account to use this.
          </p>
        )}
        {selectedDeptBudgetHint(recallAccountId)}
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className="rounded-md border px-3 py-2"
            value={recallAccountId}
            onChange={(e) => setRecallAccountId(e.target.value)}
            aria-label="Department account to recall from"
          >
            <option value="">Select department account</option>
            {childDepartmentAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email} — {a.department?.label || "Department"}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border px-3 py-2"
            type="number"
            min="0.1"
            step="0.1"
            value={recallAmount}
            onChange={(e) => setRecallAmount(e.target.value)}
            placeholder="Amount in coins"
            aria-label="Recall amount in coins"
          />
          <button type="button" className="rounded-md border px-3 py-2" onClick={() => void recallBudgetCoins()}>
            Recall to company wallet
          </button>
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
                Auto (urgent): {p.isAutoApproveEnabled ? "On" : "Off"} | Max urgent total in window: {Number(p.maxAutoApproveAmount || 0).toFixed(2)} | Window: {p.minHoursBetweenReq}h
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-destructive hover:underline"
                onClick={() => deletePolicy(p.id)}
              >
                Remove policy
              </button>
            </div>
          ))}
          {policies.length === 0 && <p className="text-sm text-muted-foreground">No policies yet.</p>}
        </div>
      </section>
      )}

      <section className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Budget requests</h2>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={requestSort}
              onChange={(e) => setRequestSort(e.target.value as typeof requestSort)}
              aria-label="Sort budget requests"
            >
              <option value="createdAt-desc">Date (newest first)</option>
              <option value="createdAt-asc">Date (oldest first)</option>
              <option value="amount-desc">Amount (high → low)</option>
              <option value="amount-asc">Amount (low → high)</option>
              <option value="priority">Priority (Urgent first)</option>
              <option value="status">Status (Pending first)</option>
            </select>
          </label>
        </div>
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
            {sortedRequests.map((r) => renderRequestRow(r, r.status === "PENDING"))}
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
