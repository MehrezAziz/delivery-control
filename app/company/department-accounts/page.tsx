"use client";

import { useEffect, useState } from "react";

type Department = { id: string; label: string; isMainDepartment?: boolean };
type DepartmentAccount = {
  id: string;
  email: string;
  role: string;
  status: string;
  departmentId: string;
  department?: Department;
};

export default function CompanyDepartmentAccountsPage() {
  const [accounts, setAccounts] = useState<DepartmentAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("DEPT_OPERATOR");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [accData, depData] = await Promise.all([
        fetch("/api/company/department-accounts").then((x) => x.json()),
        fetch("/api/company/departments").then((x) => x.json()),
      ]);
      const deps = Array.isArray(depData) ? depData : [];
      setDepartments(deps);
      if (!departmentId && deps.length > 0) setDepartmentId(deps[0].id);
      setAccounts(Array.isArray(accData) ? accData : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load department accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createAccount = async () => {
    setMessage(null);
    const res = await fetch("/api/company/department-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, departmentId, role }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to create account");
    setMessage("Department account created.");
    setEmail("");
    setPassword("");
    await load();
  };

  const toggleStatus = async (a: DepartmentAccount) => {
    const next = a.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/company/department-accounts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to update account");
    setMessage("Department account updated.");
    await load();
  };

  if (loading) return <div>Loading department accounts...</div>;

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Create Department Account</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded-md border px-3 py-2" placeholder="Account email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded-md border px-3 py-2" type="password" placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select className="rounded-md border px-3 py-2" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} {d.isMainDepartment ? "(Main)" : ""}
              </option>
            ))}
          </select>
          <select className="rounded-md border px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="DEPT_ADMIN">Dept admin</option>
            <option value="DEPT_OPERATOR">Dept operator</option>
            <option value="DEPT_VIEWER">Dept viewer</option>
          </select>
        </div>
        <button className="mt-3 rounded-md border px-3 py-2" onClick={createAccount}>Create account</button>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Department Accounts</h2>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{a.email}</span>
                <span>{a.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {a.role} - {a.department?.label || a.departmentId}
              </p>
              <button className="mt-2 rounded-md border px-2 py-1 text-xs" onClick={() => toggleStatus(a)}>
                {a.status === "ACTIVE" ? "Suspend" : "Activate"}
              </button>
            </div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts yet.</p>}
        </div>
      </section>
    </div>
  );
}
