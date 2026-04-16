"use client";

import { useEffect, useState } from "react";

type CompanyAddress = {
  id: string;
  label: string;
  city?: string | null;
  country?: string | null;
  isDefault?: boolean;
};

type CompanyProfile = {
  addresses?: CompanyAddress[];
};

export default function CompanyDepartmentsPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const load = async (keepLoading = false) => {
    if (!keepLoading) setLoading(true);
    try {
      const res = await fetch("/api/company/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load departments");
      setProfile(data);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load departments");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createDepartment = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/company/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          city: city || undefined,
          country: country || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create department");
      setMessage("Department created.");
      setLabel("");
      setCity("");
      setCountry("");
      await load(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to create department");
    }
  };

  if (loading) return <div>Loading departments...</div>;

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Add Department</h2>
        <div className="grid gap-2 md:grid-cols-4">
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <button className="rounded-md border px-3 py-2" onClick={createDepartment}>
            Create
          </button>
        </div>
      </section>
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Department List</h2>
        <div className="space-y-2">
          {(profile?.addresses || []).map((addr) => (
            <div key={addr.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{addr.label}</span>
                <span>{addr.isDefault ? "Default" : ""}</span>
              </div>
              <p className="text-xs text-muted-foreground">ID: {addr.id}</p>
              <p className="text-xs text-muted-foreground">
                {addr.city || "-"} {addr.country ? `- ${addr.country}` : ""}
              </p>
            </div>
          ))}
          {(profile?.addresses || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No departments yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
