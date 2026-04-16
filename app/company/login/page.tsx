"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompanyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const useEmailPassword = !!(email.trim() && password.trim());
    const useLegacy = !!(companyId.trim() && apiKey.trim());
    if (!useEmailPassword && !useLegacy) {
      setError("Enter either email + password or company ID + API key.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/company-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useEmailPassword ? { email: email.trim(), password } : { companyId: companyId.trim(), apiKey: apiKey.trim() },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      router.push("/company/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6">
        <div>
          <h1 className="text-xl font-semibold">Delivery Company Login</h1>
          <p className="text-sm text-muted-foreground">
            Use company email/password or department account email/password. Legacy company ID/API key still works.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Company Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            placeholder="company@example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            type="password"
            placeholder="Password"
          />
        </div>
        <p className="text-xs text-muted-foreground">OR use legacy API key login</p>
        <div className="space-y-2">
          <label className="text-sm font-medium">Company ID</label>
          <input
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <textarea
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="min-h-24 w-full rounded-md border px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
