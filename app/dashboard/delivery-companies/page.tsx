"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DeliveryCompany = {
  id: string;
  name: string;
  contactEmail?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  status: string;
  coinBalance: string | number;
  maxNegativeBalance: string | number;
  defaultDiscountPercent?: string | number | null;
};

export default function DeliveryCompaniesPage() {
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editMaxNegativeBalance, setEditMaxNegativeBalance] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<string>("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery-companies");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCompanies(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load delivery companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalBalance = useMemo(
    () => companies.reduce((sum, c) => sum + Number(c.coinBalance || 0), 0),
    [companies],
  );

  async function createCompany() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contactEmail: contactEmail.trim() || null, password: initialPassword || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Creation failed");
      setName("");
      setContactEmail("");
      setInitialPassword("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(company: DeliveryCompany) {
    setEditingId(company.id);
    setEditName(company.name);
    setEditStatus(company.status || "ACTIVE");
    setEditEmail(company.contactEmail || "");
    setEditPassword("");
    setEditMaxNegativeBalance(Number(company.maxNegativeBalance || 0));
    setEditDiscount(
      company.defaultDiscountPercent !== undefined &&
        company.defaultDiscountPercent !== null
        ? String(company.defaultDiscountPercent)
        : "",
    );
  }

  async function saveEdit(companyId: string) {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        status: editStatus,
        contactEmail: editEmail.trim() || null,
        maxNegativeBalance: editMaxNegativeBalance,
      };
      if (editPassword.trim() !== "") {
        payload.password = editPassword.trim();
      }
      if (editDiscount.trim() !== "") {
        payload.defaultDiscountPercent = Number(editDiscount);
      } else {
        payload.defaultDiscountPercent = null;
      }
      const res = await fetch(`/api/delivery-companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Delivery Companies</h1>
      <div className="flex gap-2">
        <Link href="/dashboard/delivery-companies/refunds" className="rounded-md border px-3 py-2 text-sm">
          Refund Approval Workflow
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create company</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
          />
          <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Company email" />
          <Input value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} placeholder="Initial password" />
          <Button onClick={createCompany} disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Companies: {companies.length}</p>
          <p>Total company coin balance: {totalBalance.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {!loading && companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delivery companies yet.</p>
          ) : null}
          {companies.map((c) => (
            <div key={c.id} className="rounded-md border p-3 text-sm">
              {editingId === c.id ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Company name"
                  />
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Company email" />
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="New password (optional)"
                  />
                  <div className="flex gap-2">
                    <select
                      className="w-full rounded-md border bg-background px-2 py-2"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                    <Input
                      type="number"
                      value={editMaxNegativeBalance}
                      onChange={(e) => setEditMaxNegativeBalance(Number(e.target.value))}
                      placeholder="Max negative balance"
                    />
                    <Input
                      type="number"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                      placeholder="Discount % (optional)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveEdit(c.id)} disabled={saving || !editName.trim()}>
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-muted-foreground">Status: {c.status}</div>
                  <div className="text-muted-foreground">Email: {c.contactEmail || "-"}</div>
                  <div className="text-muted-foreground">Coin balance: {Number(c.coinBalance).toFixed(2)}</div>
                  <div className="text-muted-foreground">Max negative: {Number(c.maxNegativeBalance).toFixed(2)}</div>
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                      Edit
                    </Button>
                    <Link href={`/dashboard/delivery-companies/${c.id}`} className="ml-2 inline-flex rounded-md border px-3 py-1 text-xs">
                      Details
                    </Link>
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
