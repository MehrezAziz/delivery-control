"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function DeliveryCompanyDetailsPage() {
  const params = useParams<{ id: string }>();
  const [company, setCompany] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [deptLabel, setDeptLabel] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankIban, setBankIban] = useState("");

  const load = async () => {
    const [companiesRes, deptRes, bankRes, logRes, reconRes] = await Promise.all([
      fetch("/api/delivery-companies").then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/departments`).then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/bank-accounts`).then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/audit-logs`).then((r) => r.json()),
      fetch(`/api/delivery-companies/${params.id}/reconciliation`).then((r) => r.json()),
    ]);
    setCompany((Array.isArray(companiesRes) ? companiesRes : []).find((c: any) => c.id === params.id) || null);
    setDepartments(Array.isArray(deptRes) ? deptRes : []);
    setBankAccounts(Array.isArray(bankRes) ? bankRes : []);
    setAuditLogs(Array.isArray(logRes) ? logRes : []);
    setRecon(reconRes || null);
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const addDepartment = async () => {
    const res = await fetch(`/api/delivery-companies/${params.id}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: deptLabel }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to add department");
    setDeptLabel("");
    await load();
  };

  const addBank = async () => {
    const res = await fetch(`/api/delivery-companies/${params.id}/bank-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountHolderName: bankHolder, iban: bankIban }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to add bank");
    setBankHolder("");
    setBankIban("");
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Delivery Company Details</h1>
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}

      <section className="rounded-lg border p-4 text-sm">
        <p>Name: {company?.name || "-"}</p>
        <p>Email: {company?.contactEmail || "-"}</p>
        <p>Status: {company?.status || "-"}</p>
        <p>Discount: {company?.defaultDiscountPercent ?? "-"}</p>
        <p>Max negative balance: {company?.maxNegativeBalance ?? "-"}</p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">Manage Departments</h2>
        <div className="mb-3 flex gap-2">
          <input className="w-full rounded-md border px-3 py-2" placeholder="Department label" value={deptLabel} onChange={(e) => setDeptLabel(e.target.value)} />
          <button className="rounded-md border px-3 py-2" onClick={addDepartment}>Add</button>
        </div>
        <div className="space-y-2 text-sm">
          {departments.map((d) => <div key={d.id} className="rounded-md border p-2">{d.label} ({d.id})</div>)}
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">Manage Bank Accounts</h2>
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <input className="rounded-md border px-3 py-2" placeholder="Account holder" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
          <input className="rounded-md border px-3 py-2" placeholder="IBAN" value={bankIban} onChange={(e) => setBankIban(e.target.value)} />
          <button className="rounded-md border px-3 py-2" onClick={addBank}>Add</button>
        </div>
        <div className="space-y-2 text-sm">
          {bankAccounts.map((b) => <div key={b.id} className="rounded-md border p-2">{b.accountHolderName} - {b.iban || "-"}</div>)}
        </div>
      </section>

      <section className="rounded-lg border p-4 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Reconciliation</h2>
        <p>Orders total: {Number(recon?.orderTotal || 0).toFixed(2)}</p>
        <p>Transactions total: {Number(recon?.txTotal || 0).toFixed(2)}</p>
        <p>Difference: {Number(recon?.difference || 0).toFixed(2)}</p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">Audit Log</h2>
        <div className="space-y-2 text-sm">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-md border p-2">
              <p className="font-medium">{log.actionType}</p>
              <p className="text-xs text-muted-foreground">{log.actorType} - {new Date(log.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
