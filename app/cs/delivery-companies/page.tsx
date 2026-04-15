"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DeliveryCompany = {
  id: string;
  name: string;
  status: string;
  coinBalance: string | number;
};

export default function CsDeliveryCompaniesPage() {
  const [rows, setRows] = useState<DeliveryCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/delivery-companies")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load");
        return data;
      })
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Delivery Companies</h1>
      <Card>
        <CardHeader>
          <CardTitle>Visible companies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies found.</p>
          ) : null}
          {rows.map((c) => (
            <div key={c.id} className="rounded border p-3 text-sm">
              <div className="font-medium">{c.name}</div>
              <div className="text-muted-foreground">Status: {c.status}</div>
              <div className="text-muted-foreground">Balance: {Number(c.coinBalance).toFixed(2)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
