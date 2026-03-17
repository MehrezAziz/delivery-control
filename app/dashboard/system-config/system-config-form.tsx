"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfigData {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
}

export default function SystemConfigForm({ config }: { config: ConfigData | null }) {
  const [key, setKey] = useState(config?.key || "");
  const [value, setValue] = useState(config?.value || "");
  const [category, setCategory] = useState(config?.category || "");
  const [description, setDescription] = useState(config?.description || "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/system-config", {
        method: config ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: config?.id, key, value, category, description }),
      });
      if (!config) { setKey(""); setValue(""); setCategory(""); setDescription(""); }
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {!config && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Key</Label>
            <Input value={key} onChange={e => setKey(e.target.value)} required className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} required className="w-32" />
          </div>
        </>
      )}
      {config && <span className="text-sm font-medium min-w-[120px]">{config.key}</span>}
      <div className="space-y-1 flex-1 min-w-[200px]">
        <Label className="text-xs">Value</Label>
        <Input value={value} onChange={e => setValue(e.target.value)} required />
      </div>
      {!config && (
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} className="w-48" />
        </div>
      )}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving..." : config ? "Update" : "Add"}
      </Button>
    </form>
  );
}
