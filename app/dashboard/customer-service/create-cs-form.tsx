"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_MAX_ANALYTICS_DAYS = 7;
const MIN_MAX_ANALYTICS_DAYS = 1;
const MAX_MAX_ANALYTICS_DAYS = 3650;

const ALL_ROLES = [
  "READ_DRIVER_PROFILE", "READ_CUSTOMER_PROFILE", "UPDATE_DRIVER_STATUS",
  "UPDATE_CUSTOMER_STATUS", "VERIFY_ACCOUNTS", "ACCEPT_LOCAL_PAYMENT",
  "VIEW_DELIVERIES", "MANAGE_DISPUTES", "MANAGE_SUPPORT_TICKETS",
  "VIEW_FINANCIAL_REPORTS", "MANAGE_FINANCIAL_REPORTS",
];

export default function CreateCSForm() {
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [financialAnalyticsMaxDays, setFinancialAnalyticsMaxDays] = useState<number>(DEFAULT_MAX_ANALYTICS_DAYS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function toggleRole(role: string) {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (roles.length === 0) { setError("Select at least one role"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/customer-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, email, telephone, password, roles, financialAnalyticsMaxDays }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create"); return; }
      setPseudo(""); setEmail(""); setTelephone(""); setPassword(""); setRoles([]);
      setFinancialAnalyticsMaxDays(DEFAULT_MAX_ANALYTICS_DAYS);
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Customer Service Account</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pseudo</Label>
              <Input value={pseudo} onChange={e => setPseudo(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Telephone</Label>
              <Input value={telephone} onChange={e => setTelephone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Roles (Permissions)</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(role => (
                <button key={role} type="button" onClick={() => toggleRole(role)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${roles.includes(role) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"}`}>
                  {role.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>CS Analytics Max Days</Label>
            <Input
              type="number"
              min={MIN_MAX_ANALYTICS_DAYS}
              max={MAX_MAX_ANALYTICS_DAYS}
              value={financialAnalyticsMaxDays}
              onChange={(e) => setFinancialAnalyticsMaxDays(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Admin-defined limit for analytics window (e.g. 7, 365, 372).
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Account"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
