"use client";

import { useEffect, useState } from "react";
import { buildIdempotencyKey } from "@/lib/idempotency";

type Department = { id: string; label: string; isMainDepartment?: boolean };
type Policy = {
  id: string;
  departmentId: string;
  periodType: string;
  intervalDays?: number | null;
  maxAutoApproveAmount: string | number;
  minHoursBetweenReq: number;
  isAutoApproveEnabled: boolean;
  department?: Department;
};
type RequestRow = {
  id: string;
  departmentId: string;
  amountCoins: string | number;
  priority: string;
  status: string;
  createdAt: string;
  department?: Department;
};

export default function CompanyBudgetsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [periodType, setPeriodType] = useState("MONTHLY");
  const [intervalDays, setIntervalDays] = useState("5");
  const [maxAutoApproveAmount, setMaxAutoApproveAmount] = useState("0");
  const [minHoursBetweenReq, setMinHoursBetweenReq] = useState("0");
  const [isAutoApproveEnabled, setIsAutoApproveEnabled] = useState(false);
  const [requestAmount, setRequestAmount] = useState("50");
  const [priority, setPriority] = useState("NORMAL");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [dep, pol, reqs] = await Promise.all([
        fetch("/api/company/departments").then((x) => x.json()),
        fetch("/api/company/budget-policies").then((x) => x.json()),
        fetch("/api/company/budget-requests").then((x) => x.json()),
      ]);
      const deps = Array.isArray(dep) ? dep : [];
      setDepartments(deps);
      if (!departmentId && deps.length > 0) setDepartmentId(deps[0].id);
      setPolicies(Array.isArray(pol) ? pol : []);
      setRequests(Array.isArray(reqs) ? reqs : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const savePolicy = async () => {
    setMessage(null);
    const res = await fetch("/api/company/budget-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentId,
        periodType,
        intervalDays: periodType === "CUSTOM_INTERVAL" ? Number(intervalDays || 0) : null,
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
      departmentId,
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
    setMessage(`Budget request created (${data.status}).`);
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

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Budget Policy (Main Department)</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <select className="rounded-md border px-3 py-2" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} {d.isMainDepartment ? "(Main)" : ""}
              </option>
            ))}
          </select>
          <select className="rounded-md border px-3 py-2" value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
            <option value="CUSTOM_INTERVAL">Custom interval</option>
          </select>
          {periodType === "CUSTOM_INTERVAL" && (
            <input className="rounded-md border px-3 py-2" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} placeholder="Every X days" />
          )}
          <input className="rounded-md border px-3 py-2" type="number" min="0" step="0.1" value={maxAutoApproveAmount} onChange={(e) => setMaxAutoApproveAmount(e.target.value)} placeholder="Max auto-approved amount" />
          <input className="rounded-md border px-3 py-2" type="number" min="0" value={minHoursBetweenReq} onChange={(e) => setMinHoursBetweenReq(e.target.value)} placeholder="Min hours between requests" />
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input type="checkbox" checked={isAutoApproveEnabled} onChange={(e) => setIsAutoApproveEnabled(e.target.checked)} />
            Enable auto-approve
          </label>
        </div>
        <button className="rounded-md border px-3 py-2" onClick={savePolicy}>Save policy</button>
      </section>

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

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Active Policies</h2>
        <div className="space-y-2">
          {policies.map((p) => (
            <div key={p.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span>{p.department?.label || p.departmentId}</span>
                <span>{p.periodType}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto: {p.isAutoApproveEnabled ? "Enabled" : "Disabled"} | Max auto: {Number(p.maxAutoApproveAmount || 0).toFixed(2)} | Cooldown: {p.minHoursBetweenReq}h
              </p>
            </div>
          ))}
          {policies.length === 0 && <p className="text-sm text-muted-foreground">No policies yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Budget Requests History</h2>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span>{r.department?.label || r.departmentId}</span>
                <span>{r.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Amount: {Number(r.amountCoins || 0).toFixed(2)} | Priority: {r.priority}
              </p>
              {r.status === "PENDING" && (
                <div className="mt-2 flex gap-2">
                  <button className="rounded-md border px-2 py-1 text-xs" onClick={() => decide(r.id, "APPROVE")}>
                    Approve
                  </button>
                  <button className="rounded-md border px-2 py-1 text-xs" onClick={() => decide(r.id, "REJECT")}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {requests.length === 0 && <p className="text-sm text-muted-foreground">No budget requests yet.</p>}
        </div>
      </section>
    </div>
  );
}
