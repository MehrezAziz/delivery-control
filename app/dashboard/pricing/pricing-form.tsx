"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface PolicyData {
  id: string;
  pricePerKm: number;
  baseFee: number;
  baseWeight: number;
  extraWeightStep: number;
  extraWeightPrice: number;
  nightFee: number;
  platformFee: number;
  maxNegativeDays: number;
  isActive: boolean;
}

const fields = [
  { key: "pricePerKm", label: "Price/Km", step: "0.01" },
  { key: "baseFee", label: "Base Fee", step: "0.01" },
  { key: "baseWeight", label: "Base Weight (kg)", step: "0.01" },
  { key: "extraWeightStep", label: "Extra Weight Step", step: "0.01" },
  { key: "extraWeightPrice", label: "Extra Weight Price", step: "0.01" },
  { key: "nightFee", label: "Night Fee", step: "0.01" },
  { key: "platformFee", label: "Platform Fee", step: "0.01" },
  { key: "maxNegativeDays", label: "Max Negative Days", step: "1" },
] as const;

const defaultValues: Omit<PolicyData, "id" | "isActive"> = {
  pricePerKm: 0, baseFee: 0, baseWeight: 0, extraWeightStep: 0,
  extraWeightPrice: 0, nightFee: 0, platformFee: 0, maxNegativeDays: 0,
};

export default function PricingForm({ countryId, zoneType, policy }: { countryId: string; zoneType: string; policy: PolicyData | null }) {
  const [form, setForm] = useState(policy || { ...defaultValues, id: "", isActive: true });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleChange(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: key === "maxNegativeDays" ? parseInt(value) || 0 : parseFloat(value) || 0 }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/pricing", {
        method: policy ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, countryId, deliveryZoneType: zoneType }),
      });
      router.refresh();
    } finally { setLoading(false); }
  }

  const zoneLabel = zoneType.replace(/_/g, " ");

  return (
    <form onSubmit={handleSubmit} className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant={policy ? "default" : "secondary"}>{zoneLabel}</Badge>
        {policy && <span className="text-xs text-muted-foreground">ID: {policy.id.slice(0, 8)}...</span>}
      </div>
      <div className="grid gap-2 grid-cols-2">
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input type="number" step={f.step} value={form[f.key as keyof typeof defaultValues]} onChange={e => handleChange(f.key, e.target.value)} />
          </div>
        ))}
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving..." : policy ? "Update" : "Create"}
      </Button>
    </form>
  );
}
