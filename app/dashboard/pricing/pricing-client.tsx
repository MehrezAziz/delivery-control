"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import PricingForm from "./pricing-form";

const ZONE_TYPES = ["SAME_DELEGATION", "SAME_GOVERNORATE", "DIFFERENT_GOVERNORATE", "DIFFERENT_COUNTRY"] as const;

interface PolicyData {
  id: string;
  deliveryZoneType: string | null;
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

interface CountryData {
  id: string;
  name: string;
  isoCode: string;
  currencyCode: string;
  currencySymbol: string;
  policies: PolicyData[];
}

const emptyValues = {
  pricePerKm: 0, baseFee: 0, baseWeight: 0, extraWeightStep: 0,
  extraWeightPrice: 0, nightFee: 0, platformFee: 0, maxNegativeDays: 0,
};

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

export default function PricingClient({ countries }: { countries: CountryData[] }) {
  const [search, setSearch] = useState("");
  const [defaults, setDefaults] = useState<Record<string, typeof emptyValues>>(
    Object.fromEntries(ZONE_TYPES.map(z => [z, { ...emptyValues }]))
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [applyLoading, setApplyLoading] = useState(false);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.isoCode.toLowerCase().includes(search.toLowerCase())
  );

  function handleDefaultChange(zone: string, key: string, value: string) {
    setDefaults(prev => ({
      ...prev,
      [zone]: {
        ...prev[zone],
        [key]: key === "maxNegativeDays" ? parseInt(value) || 0 : parseFloat(value) || 0,
      },
    }));
  }

  function toggleCountry(id: string) {
    setSelectedCountries(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedCountries(filtered.map(c => c.id));
  }

  function deselectAll() {
    setSelectedCountries([]);
  }

  async function applyToCountries(countryIds: string[]) {
    setSuccessMsg("");
    const body = {
      countryIds,
      zones: Object.fromEntries(
        ZONE_TYPES.map(z => [z, defaults[z]])
      ),
    };
    const res = await fetch("/api/pricing/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setSuccessMsg(`Pricing policies applied successfully (${data.created} created, ${data.updated} updated)`);
      setSelectedCountries([]);
      router.refresh();
    }
    return res.ok;
  }

  async function handleApplyAll() {
    setDefaultsLoading(true);
    await applyToCountries(countries.map(c => c.id));
    setDefaultsLoading(false);
  }

  async function handleApplySelected() {
    if (selectedCountries.length === 0) return;
    setApplyLoading(true);
    await applyToCountries(selectedCountries);
    setApplyLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Country Pricing Policies</h1>

      {/* Default values for all 4 zones */}
      <Card>
        <CardHeader>
          <CardTitle>Default Values (Apply to Multiple Countries)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fill in default values for each zone type, then apply to all countries or selected ones.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {ZONE_TYPES.map(zone => (
              <div key={zone} className="border rounded p-4 space-y-3">
                <Badge>{zone.replace(/_/g, " ")}</Badge>
                <div className="grid gap-2 grid-cols-2">
                  {fields.map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        type="number"
                        step={f.step}
                        value={defaults[zone][f.key as keyof typeof emptyValues]}
                        onChange={e => handleDefaultChange(zone, f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleApplyAll} disabled={defaultsLoading}>
              {defaultsLoading ? "Applying..." : "Save to ALL Countries"}
            </Button>
            <Button onClick={handleApplySelected} disabled={applyLoading || selectedCountries.length === 0} variant="outline">
              {applyLoading ? "Applying..." : `Apply to Selected (${selectedCountries.length})`}
            </Button>
          </div>

          {successMsg && (
            <p className="text-sm text-green-600 font-medium">{successMsg}</p>
          )}

          {/* Country selection for bulk apply */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Select countries:</Label>
              <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>Deselect All</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {countries.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCountry(c.id)}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    selectedCountries.includes(c.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:bg-accent"
                  }`}
                >
                  {c.name} ({c.isoCode})
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by country name or ISO code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">{filtered.length} countries</span>
      </div>

      {/* Per-country pricing */}
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No countries match your search.</p>
      ) : (
        filtered.map(country => (
          <Card key={country.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {country.name} <Badge variant="outline">{country.isoCode}</Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  {country.currencyCode} ({country.currencySymbol})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                {ZONE_TYPES.map(zone => {
                  const policy = country.policies.find(p => p.deliveryZoneType === zone);
                  return (
                    <PricingForm
                      key={zone}
                      countryId={country.id}
                      zoneType={zone}
                      policy={policy ? {
                        id: policy.id,
                        pricePerKm: policy.pricePerKm,
                        baseFee: policy.baseFee,
                        baseWeight: policy.baseWeight,
                        extraWeightStep: policy.extraWeightStep,
                        extraWeightPrice: policy.extraWeightPrice,
                        nightFee: policy.nightFee,
                        platformFee: policy.platformFee,
                        maxNegativeDays: policy.maxNegativeDays,
                        isActive: policy.isActive,
                      } : null}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
