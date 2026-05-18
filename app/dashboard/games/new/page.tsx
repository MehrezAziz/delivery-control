"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLACEMENTS_CUSTOMER = [
  "CUSTOMER_HOME",
  "CUSTOMER_WALLET",
  "CUSTOMER_ORDERS",
  "CUSTOMER_PROFILE",
  "CUSTOMER_SETTINGS",
  "CUSTOMER_SUPPORT",
];
const PLACEMENTS_DRIVER = [
  "DRIVER_HOME",
  "DRIVER_EARNINGS",
  "DRIVER_TRANSACTIONS",
  "DRIVER_PROFILE",
  "DRIVER_SETTINGS",
  "DRIVER_SUPPORT",
  "DRIVER_MY_ORDERS",
];

export default function NewGamePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    isActive: false,
    scheduleMode: "ALL_DAYS",
    periodMode: "DAILY",
    customPeriodDays: 5,
    customPeriodAnchor: "FIXED_BLOCKS",
    questionsPerDay: 5,
    requireCompletedOrder: false,
    winnerSelectionMode: "RANDOM",
    coinCreditMode: "AUTO_ON_CONFIRM",
    winnerPoolMode: "COMBINED",
    customerButtonPlacement: "CUSTOMER_HOME",
    driverButtonPlacement: "DRIVER_HOME",
    countryIds: [] as string[],
    prizeTiers: [
      { rank: 1, prizeType: "COINS", coinAmount: 1000, prizeLabel: "1st prize" },
    ],
    bannerImageUrls: [] as string[],
  });

  useEffect(() => {
    void fetch("/api/countries")
      .then((r) => r.json())
      .then((rows) => setCountries(rows))
      .catch(() => setCountries([]));
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCreatedCode(data.accessCodePlain);
      setTimeout(() => router.push(`/dashboard/games/${data.id}`), 1500);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">New quiz game</h1>
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <Label>Questions per day</Label>
            <Input
              type="number"
              value={form.questionsPerDay}
              onChange={(e) => setForm({ ...form, questionsPerDay: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Customer button placement</Label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-background"
              value={form.customerButtonPlacement}
              onChange={(e) => setForm({ ...form, customerButtonPlacement: e.target.value })}
            >
              {PLACEMENTS_CUSTOMER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Driver button placement</Label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-background"
              value={form.driverButtonPlacement}
              onChange={(e) => setForm({ ...form, driverButtonPlacement: e.target.value })}
            >
              {PLACEMENTS_DRIVER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Countries</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {countries.map((c) => {
                const on = form.countryIds.includes(c.id);
                return (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() =>
                      setForm({
                        ...form,
                        countryIds: on
                          ? form.countryIds.filter((id) => id !== c.id)
                          : [...form.countryIds, c.id],
                      })
                    }
                  >
                    {c.name}
                  </Button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requireCompletedOrder}
              onChange={(e) => setForm({ ...form, requireCompletedOrder: e.target.checked })}
            />
            Require at least one delivered order to win
          </label>
          {createdCode && (
            <p className="text-sm font-medium text-green-600">
              Access code (share on social): {createdCode}
            </p>
          )}
          <Button onClick={() => void submit()} disabled={saving || !form.name.trim()}>
            {saving ? "Creating…" : "Create game"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
