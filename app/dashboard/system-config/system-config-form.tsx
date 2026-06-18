"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Info, Save } from "lucide-react";

interface ConfigData {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
}

export default function SystemConfigForm({
  config,
  onCancel,
}: {
  config: ConfigData | null;
  onCancel?: () => void;
}) {
  const [key, setKey] = useState(config?.key || "");
  const [value, setValue] = useState(config?.value || "");
  const [category, setCategory] = useState(config?.category || "");
  const [description, setDescription] = useState(config?.description || "");
  const [loading, setLoading] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const router = useRouter();

  const isDirty = config
    ? value !== config.value || description !== (config.description || "")
    : key.trim() !== "" || value.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/system-config", {
        method: config ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: config?.id, key, value, category, description }),
      });
      if (!config) {
        setKey("");
        setValue("");
        setCategory("");
        setDescription("");
        onCancel?.();
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!config) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} required placeholder="e.g. ai_support_enabled" />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} required placeholder="e.g. ai" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Value</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} required placeholder="true / false / number" />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this setting controls…"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving…" : "Add configuration"}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setDescOpen((o) => !o)}
            className="group flex items-center gap-2 text-left w-full"
          >
            <Badge variant="outline" className="font-mono text-xs shrink-0 bg-slate-50 dark:bg-slate-900/40">
              {config.key}
            </Badge>
            {config.description ? (
              descOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              )
            ) : null}
            {!config.description && (
              <span className="text-xs text-muted-foreground italic">No description</span>
            )}
          </button>

          {descOpen && config.description && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
              <p>{config.description}</p>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 w-full sm:w-auto sm:min-w-[280px]">
          <div className="space-y-1 flex-1">
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="font-mono text-sm"
            />
          </div>
          <Button type="submit" size="sm" disabled={loading || !isDirty} variant={isDirty ? "default" : "secondary"}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {loading ? "…" : isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {descOpen && !config.description && (
        <p className="text-xs text-muted-foreground italic">This key has no description on file.</p>
      )}
    </form>
  );
}
