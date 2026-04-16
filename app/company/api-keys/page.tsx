"use client";

import { useEffect, useState } from "react";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  createdAt: string;
};

export default function CompanyApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/company/api-keys");
    const data = await res.json();
    if (res.ok) setKeys(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    void load();
  }, []);

  const createKey = async () => {
    setMessage(null);
    setRawKey(null);
    const res = await fetch("/api/company/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "company-key" }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to create key");
    setRawKey(data.rawKey);
    setName("");
    await load();
  };

  const revoke = async (id: string) => {
    const res = await fetch(`/api/company/api-keys/${id}/revoke`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to revoke");
    await load();
  };

  const reactivate = async (id: string) => {
    const res = await fetch(`/api/company/api-keys/${id}/reactivate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to reactivate");
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">API Keys</h1>
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      {rawKey && (
        <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm">
          New API key (save now, shown once): <code>{rawKey}</code>
        </div>
      )}
      <section className="rounded-lg border p-4 flex gap-2">
        <input className="w-full rounded-md border px-3 py-2" placeholder="Key name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="rounded-md border px-3 py-2" onClick={createKey}>Generate</button>
      </section>
      <section className="rounded-lg border p-4 space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground">{k.keyPrefix}... | {k.status}</p>
                <p className="text-xs text-muted-foreground">Scopes: {(k.scopes || []).join(", ")}</p>
              </div>
              <div className="flex items-center gap-2">
                {k.status === "ACTIVE" && (
                  <button className="rounded-md border px-2 py-1 text-xs" onClick={() => revoke(k.id)}>
                    Revoke
                  </button>
                )}
                {k.status === "REVOKED" && (
                  <button className="rounded-md border px-2 py-1 text-xs" onClick={() => reactivate(k.id)}>
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {keys.length === 0 && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
      </section>
    </div>
  );
}
