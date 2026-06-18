"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Filter,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import SystemConfigForm from "./system-config-form";

export type ConfigItem = {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
};

export default function SystemConfigClient({
  configs,
  stats,
}: {
  configs: ConfigItem[];
  stats: {
    total: number;
    categories: number;
    withDescription: number;
  };
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(configs.map((c) => c.category));
    return [...set].sort();
  }, [configs]);

  const filtered = useMemo(() => {
    let result = configs;
    if (categoryFilter !== "all") result = result.filter((c) => c.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.key.toLowerCase().includes(q) ||
          c.value.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [configs, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ConfigItem[]>();
    for (const c of filtered) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50/50 via-background to-background dark:from-slate-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-600 via-zinc-600 to-slate-800 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Settings2 className="h-3.5 w-3.5" />
                  Platform settings
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">System configuration</h1>
                <p className="max-w-xl text-sm text-white/80">
                  Manage runtime flags and platform parameters stored in the database. Click a key to view its description.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen((o) => !o)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add config
              </button>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-lg">
              {[
                { label: "Total keys", value: stats.total, icon: SlidersHorizontal },
                { label: "Categories", value: stats.categories, icon: Filter },
                { label: "Documented", value: stats.withDescription, icon: Settings2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-slate-200/60 dark:border-slate-800/60">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search key, value, category, description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filtered.length} of {configs.length} keys
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === "all"
                    ? "bg-slate-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                All categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
                    categoryFilter === cat
                      ? "bg-slate-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Config groups */}
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Settings2 className="h-10 w-10 opacity-40" />
              <p>No configuration keys match your filters.</p>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("all");
                }}
              >
                Clear filters
              </button>
            </CardContent>
          </Card>
        ) : (
          grouped.map(([category, items]) => (
            <Card key={category} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2 text-lg capitalize">
                  <Badge variant="outline" className="font-mono text-xs">
                    {category}
                  </Badge>
                  <span className="text-muted-foreground text-sm font-normal">
                    {items.length} key{items.length !== 1 ? "s" : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {items.map((config) => (
                  <div key={config.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <SystemConfigForm config={config} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}

        {/* Add new */}
        {addOpen && (
          <Card className="border-slate-200/60 dark:border-slate-800/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5 text-slate-600" />
                Add new configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SystemConfigForm config={null} onCancel={() => setAddOpen(false)} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
