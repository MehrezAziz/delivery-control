"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Shield, BarChart3 } from "lucide-react";
import { CsRolePicker } from "@/components/admin/cs-role-picker";

const DEFAULT_MAX_ANALYTICS_DAYS = 7;
const MIN_MAX_ANALYTICS_DAYS = 1;
const MAX_MAX_ANALYTICS_DAYS = 3650;

export default function CreateCSForm() {
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [financialAnalyticsMaxDays, setFinancialAnalyticsMaxDays] = useState<number>(
    DEFAULT_MAX_ANALYTICS_DAYS,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (roles.length === 0) {
      setError("Select at least one permission");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/customer-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo, email, telephone, password, roles, financialAnalyticsMaxDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create");
        return;
      }
      setPseudo("");
      setEmail("");
      setTelephone("");
      setPassword("");
      setRoles([]);
      setFinancialAnalyticsMaxDays(DEFAULT_MAX_ANALYTICS_DAYS);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden border-teal-200/60 dark:border-teal-800/40">
      <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-teal-600" />
          Create account
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          New customer service agents sign in at the CS login page with the credentials below.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pseudo</Label>
              <Input
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="e.g. support_tunis"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Telephone</Label>
              <Input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+216 …"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600" />
              <Label className="text-base">Permissions</Label>
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                {roles.length} selected
              </span>
            </div>
            <CsRolePicker selected={roles} onChange={setRoles} disabled={loading} />
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 space-y-2 max-w-sm">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <Label>Analytics max range (days)</Label>
            </div>
            <Input
              type="number"
              min={MIN_MAX_ANALYTICS_DAYS}
              max={MAX_MAX_ANALYTICS_DAYS}
              value={financialAnalyticsMaxDays}
              onChange={(e) => setFinancialAnalyticsMaxDays(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Maximum date range this agent can query in financial analytics (e.g. 7, 30, 365).
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
