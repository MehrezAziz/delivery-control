"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

type Department = {
  id: string;
  label: string;
  isMainDepartment?: boolean;
  country?: string | null;
  city?: string | null;
  street?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};
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
  const [editById, setEditById] = useState<Record<string, { email: string; role: string; status: string; departmentId: string; password: string }>>({});
  const [focusedAccountId, setFocusedAccountId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const emailInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const beginEditAccount = (a: DepartmentAccount) => {
    setEditById((prev) => ({
      ...prev,
      [a.id]:
        prev[a.id] ?? {
          email: a.email,
          role: a.role,
          status: a.status,
          departmentId: a.departmentId,
          password: "",
        },
    }));
    setFocusedAccountId(a.id);
    requestAnimationFrame(() => {
      rowRefs.current.get(a.id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      emailInputRefs.current.get(a.id)?.focus();
    });
  };

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

  const saveAccount = async (a: DepartmentAccount) => {
    const edit = editById[a.id];
    if (!edit) return;
    const res = await fetch(`/api/company/department-accounts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to update account");
    setMessage("Department account updated.");
    setFocusedAccountId(null);
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
          {accounts.map((a) => {
            const isEditing = focusedAccountId === a.id;
            const hasDeptData =
              !!(
                String(a.department?.street || "").trim() ||
                String(a.department?.city || "").trim() ||
                String(a.department?.country || "").trim() ||
                (typeof a.department?.latitude === "number" && typeof a.department?.longitude === "number")
              );
            return (
            <div
              key={a.id}
              ref={(el) => {
                if (el) rowRefs.current.set(a.id, el);
                else rowRefs.current.delete(a.id);
              }}
              className={`rounded-md border p-3 text-sm transition-shadow ${
                focusedAccountId === a.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{a.email}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {hasDeptData && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Edit account"
                      aria-label={`Edit account ${a.email}`}
                      onClick={() => beginEditAccount(a)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                  <span>{a.status}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {a.role} - {a.department?.label || a.departmentId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Address: {[a.department?.street, a.department?.city, a.department?.country, a.department?.postalCode]
                  .filter(Boolean)
                  .join(", ") || "Not defined"}
                {typeof a.department?.latitude === "number" && typeof a.department?.longitude === "number"
                  ? ` | (${a.department.latitude.toFixed(5)}, ${a.department.longitude.toFixed(5)})`
                  : ""}
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  ref={(el) => {
                    if (el) emailInputRefs.current.set(a.id, el);
                    else emailInputRefs.current.delete(a.id);
                  }}
                  className="rounded-md border px-2 py-1 text-xs"
                  value={editById[a.id]?.email ?? a.email}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setEditById((prev) => ({
                      ...prev,
                      [a.id]: {
                        email: e.target.value,
                        role: prev[a.id]?.role ?? a.role,
                        status: prev[a.id]?.status ?? a.status,
                        departmentId: prev[a.id]?.departmentId ?? a.departmentId,
                        password: prev[a.id]?.password ?? "",
                      },
                    }))
                  }
                  placeholder="Email"
                />
                <select
                  className="rounded-md border px-2 py-1 text-xs"
                  value={editById[a.id]?.departmentId ?? a.departmentId}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setEditById((prev) => ({
                      ...prev,
                      [a.id]: {
                        email: prev[a.id]?.email ?? a.email,
                        role: prev[a.id]?.role ?? a.role,
                        status: prev[a.id]?.status ?? a.status,
                        departmentId: e.target.value,
                        password: prev[a.id]?.password ?? "",
                      },
                    }))
                  }
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border px-2 py-1 text-xs"
                  value={editById[a.id]?.role ?? a.role}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setEditById((prev) => ({
                      ...prev,
                      [a.id]: {
                        email: prev[a.id]?.email ?? a.email,
                        role: e.target.value,
                        status: prev[a.id]?.status ?? a.status,
                        departmentId: prev[a.id]?.departmentId ?? a.departmentId,
                        password: prev[a.id]?.password ?? "",
                      },
                    }))
                  }
                >
                  <option value="DEPT_ADMIN">Dept admin</option>
                  <option value="DEPT_OPERATOR">Dept operator</option>
                  <option value="DEPT_VIEWER">Dept viewer</option>
                </select>
                <input
                  className="rounded-md border px-2 py-1 text-xs"
                  type="password"
                  value={editById[a.id]?.password ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setEditById((prev) => ({
                      ...prev,
                      [a.id]: {
                        email: prev[a.id]?.email ?? a.email,
                        role: prev[a.id]?.role ?? a.role,
                        status: prev[a.id]?.status ?? a.status,
                        departmentId: prev[a.id]?.departmentId ?? a.departmentId,
                        password: e.target.value,
                      },
                    }))
                  }
                  placeholder="New password (optional)"
                />
              </div>
              <button className="mt-2 rounded-md border px-2 py-1 text-xs" onClick={() => toggleStatus(a)} disabled={!isEditing}>
                {a.status === "ACTIVE" ? "Suspend" : "Activate"}
              </button>
              <button className="ml-2 mt-2 rounded-md border px-2 py-1 text-xs" onClick={() => saveAccount(a)} disabled={!isEditing}>
                Save updates
              </button>
            </div>
            );
          })}
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts yet.</p>}
        </div>
      </section>
    </div>
  );
}
