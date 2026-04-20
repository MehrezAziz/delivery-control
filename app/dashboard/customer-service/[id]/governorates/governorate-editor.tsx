"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Gov = { id: string; nameGovernorate: string; delegations?: Array<{ id: string; nameDelegation: string }> };
type Country = { id: string; name: string; governorates: Gov[] };

export default function GovernorateEditor({ csId, pseudo }: { csId: string; pseudo: string }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries
      .map((c) => {
        if (c.name.toLowerCase().includes(q)) return c;
        const governorates = c.governorates.filter((g) => {
          if (g.nameGovernorate.toLowerCase().includes(q)) return true;
          return (g.delegations || []).some((d) => d.nameDelegation.toLowerCase().includes(q));
        });
        if (governorates.length === 0) return null;
        return { ...c, governorates };
      })
      .filter(Boolean) as Country[];
  }, [countries, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [treeRes, selRes] = await Promise.all([
        fetch("/api/admin/geo-tree"),
        fetch(`/api/admin/customer-services/${csId}/governorates`),
      ]);
      if (!treeRes.ok) throw new Error("Failed to load geography");
      if (!selRes.ok) throw new Error("Failed to load CS coverage");
      const tree = await treeRes.json();
      const sel = await selRes.json();
      setCountries(tree.countries || []);
      setSelected(new Set((sel.governorates || []).map((g: { id: string }) => g.id)));
    } catch (e: any) {
      setMsg(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [csId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/customer-services/${csId}/governorates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governorateIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg(`Saved (${data.count} governorates).`);
    } catch (e: any) {
      setMsg(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function addWholeCountry(countryId: string) {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/admin/customer-services/${csId}/governorates/by-country/${countryId}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
      setMsg(`Added all governorates from country (${data.added} new links).`);
    } catch (e: any) {
      setMsg(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/customer-service">
          <Button variant="outline" size="sm">← Back to CS list</Button>
        </Link>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save selection"}
        </Button>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <div className="max-w-md">
        <Input
          placeholder="Search by country, governorate, or delegation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coverage for {pseudo}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Customer service only receives order-related notifications for orders whose pickup is in one of these
            governorates. Use &quot;Add all in country&quot; to assign every governorate of a country in one step (merges
            with existing).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {filteredCountries.length === 0 && (
            <p className="text-sm text-muted-foreground">No regions match your search.</p>
          )}
          {filteredCountries.map((c) => (
            <div key={c.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{c.name}</h3>
                <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => void addWholeCountry(c.id)}>
                  Add all in country
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.governorates.map((g) => {
                  const on = selected.has(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggle(g.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                      }`}
                    >
                      {g.nameGovernorate}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
