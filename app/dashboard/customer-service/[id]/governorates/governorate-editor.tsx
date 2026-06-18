"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowLeft, MapPin, Search, Save, Globe, CheckCircle2 } from "lucide-react";

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

  const totalGovernorates = useMemo(
    () => countries.reduce((sum, c) => sum + c.governorates.length, 0),
    [countries],
  );

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
      setMsg(`Saved successfully — ${data.count} governorate${data.count === 1 ? "" : "s"} assigned.`);
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
    return (
      <div className="space-y-6 py-1">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full max-w-md rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-1">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-teal-600 via-emerald-600 to-slate-700 text-white shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3">
              <Link
                href="/dashboard/customer-service"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "bg-white/15 text-white border-white/20 hover:bg-white/25",
                )}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to CS list
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <MapPin className="h-8 w-8 opacity-90" />
                Governorate coverage
              </h1>
              <p className="text-teal-100 text-sm max-w-2xl">
                Assign regions for <span className="font-semibold text-white">{pseudo}</span>. CS agents only receive
                order notifications for pickups in selected governorates.
              </p>
            </div>
            <Button
              onClick={() => void save()}
              disabled={saving}
              className="bg-white text-teal-700 hover:bg-teal-50 shrink-0"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? "Saving…" : "Save selection"}
            </Button>
          </div>
        </div>
        <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-3 divide-x divide-white/15">
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-teal-200">Selected</p>
            <p className="text-lg font-bold tabular-nums">{selected.size}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-teal-200">Countries</p>
            <p className="text-lg font-bold tabular-nums">{countries.length}</p>
          </div>
          <div className="px-4 py-3 text-center col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-teal-200">Total regions</p>
            <p className="text-lg font-bold tabular-nums">{totalGovernorates}</p>
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm flex items-center gap-2",
            msg.includes("Error") || msg.includes("Failed")
              ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
          )}
        >
          {!msg.includes("Error") && !msg.includes("Failed") && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {msg}
        </div>
      )}

      <Card className="overflow-hidden border-teal-200/50 dark:border-teal-800/30">
        <div className="h-0.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
        <CardContent className="pt-5 pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by country, governorate, or delegation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-teal-600" />
            Coverage for {pseudo}
            <Badge variant="secondary" className="tabular-nums">{selected.size} selected</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Click governorates to toggle. Use &quot;Add all in country&quot; to assign every governorate of a country
            in one step.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredCountries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">No regions match your search.</p>
          )}
          {filteredCountries.map((c) => {
            const countrySelected = c.governorates.filter((g) => selected.has(g.id)).length;
            return (
              <div
                key={c.id}
                className="rounded-xl border bg-gradient-to-br from-teal-50/30 to-transparent dark:from-teal-950/15 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <Badge variant="outline" className="text-xs tabular-nums">
                      {countrySelected}/{c.governorates.length}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => void addWholeCountry(c.id)}
                  >
                    Add all in country
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.governorates.map((g) => {
                    const on = selected.has(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggle(g.id)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                          on
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "border-border bg-card hover:bg-accent hover:border-teal-300",
                        )}
                      >
                        {g.nameGovernorate}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
