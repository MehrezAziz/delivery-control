"use client";

import { useEffect, useState } from "react";

type CompanyAddress = {
  id: string;
  label: string;
  city?: string | null;
  country?: string | null;
  street?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};

type GeoCountry = {
  id: string;
  name: string;
  governorates: Array<{
    id: string;
    nameGovernorate: string;
    delegations: Array<{ id: string; nameDelegation: string }>;
  }>;
};

export default function CompanyDepartmentsPage() {
  const [departments, setDepartments] = useState<CompanyAddress[]>([]);
  const [geo, setGeo] = useState<GeoCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [countryId, setCountryId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [delegationId, setDelegationId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedCountry = geo.find((c) => c.id === countryId) || null;
  const selectedGovernorate = selectedCountry?.governorates.find((g) => g.id === governorateId) || null;
  const selectedDelegation = selectedGovernorate?.delegations.find((d) => d.id === delegationId) || null;

  const load = async (keepLoading = false) => {
    if (!keepLoading) setLoading(true);
    try {
      const [depRes, geoRes] = await Promise.all([
        fetch("/api/company/departments"),
        fetch("/api/company/geo"),
      ]);
      const depData = await depRes.json();
      const geoData = await geoRes.json();
      if (!depRes.ok) throw new Error(depData?.error || "Failed to load departments");
      if (!geoRes.ok) throw new Error(geoData?.error || "Failed to load geo data");
      setDepartments(Array.isArray(depData) ? depData : []);
      setGeo(Array.isArray(geoData?.countries) ? geoData.countries : []);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to load departments");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setLabel("");
    setCountryId("");
    setGovernorateId("");
    setDelegationId("");
    setLatitude("");
    setLongitude("");
    setEditingId(null);
  };

  const payload = () => {
    if (!label.trim()) throw new Error("Department label is required");
    if (!selectedCountry || !selectedGovernorate || !selectedDelegation) {
      throw new Error("Country, governorate and delegation are required");
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("Coordinates are required");
    }
    return {
      label: label.trim(),
      country: selectedCountry.name,
      governorate: selectedGovernorate.nameGovernorate,
      delegation: selectedDelegation.nameDelegation,
      delegationId: selectedDelegation.id,
      latitude: lat,
      longitude: lng,
    };
  };

  const createDepartment = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/company/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create department");
      setMessage("Department created.");
      resetForm();
      await load(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to create department");
    }
  };

  const startEdit = (addr: CompanyAddress) => {
    setEditingId(addr.id);
    setLabel(addr.label || "");
    setLatitude(addr.latitude != null ? String(addr.latitude) : "");
    setLongitude(addr.longitude != null ? String(addr.longitude) : "");
    const c = geo.find((x) => x.name === addr.country);
    const g = c?.governorates.find((x) => x.nameGovernorate === addr.city);
    const d = g?.delegations.find((x) => x.nameDelegation === addr.street);
    setCountryId(c?.id || "");
    setGovernorateId(g?.id || "");
    setDelegationId(d?.id || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setMessage(null);
    try {
      const dataPayload = payload();
      const old = departments.find((d) => d.id === editingId);
      const geoChanged =
        old?.country !== dataPayload.country ||
        old?.city !== dataPayload.governorate ||
        old?.street !== dataPayload.delegation;
      if (geoChanged) {
        const ok = window.confirm(
          "Updating country/governorate/delegation may affect deliveries and routing. Continue?",
        );
        if (!ok) return;
      }

      const res = await fetch("/api/company/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...dataPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update department");
      setMessage("Department updated.");
      resetForm();
      await load(true);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to update department");
    }
  };

  if (loading) return <div>Loading departments...</div>;

  return (
    <div className="space-y-6">
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">{editingId ? "Edit Department" : "Add Department"}</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Department label (nickname)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <select
            className="rounded-md border px-3 py-2"
            value={countryId}
            onChange={(e) => {
              setCountryId(e.target.value);
              setGovernorateId("");
              setDelegationId("");
            }}
          >
            <option value="">Select country</option>
            {geo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border px-3 py-2"
            value={governorateId}
            onChange={(e) => {
              setGovernorateId(e.target.value);
              setDelegationId("");
            }}
          >
            <option value="">Select governorate</option>
            {(selectedCountry?.governorates || []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.nameGovernorate}
              </option>
            ))}
          </select>
          <select className="rounded-md border px-3 py-2" value={delegationId} onChange={(e) => setDelegationId(e.target.value)}>
            <option value="">Select delegation</option>
            {(selectedGovernorate?.delegations || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameDelegation}
              </option>
            ))}
          </select>
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Latitude (required)"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Longitude (required)"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://www.openstreetmap.org"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Select exact position from map
          </a>
          {!editingId ? (
            <button className="rounded-md border px-3 py-2" onClick={createDepartment}>
              Create
            </button>
          ) : (
            <>
              <button className="rounded-md border px-3 py-2" onClick={saveEdit}>
                Save update
              </button>
              <button className="rounded-md border px-3 py-2" onClick={resetForm}>
                Cancel
              </button>
            </>
          )}
        </div>
      </section>
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Department List</h2>
        <div className="space-y-2">
          {departments.map((addr) => (
            <div key={addr.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{addr.label}</span>
                <button className="rounded-md border px-2 py-1 text-xs" onClick={() => startEdit(addr)}>
                  Edit
                </button>
              </div>
              <p className="text-xs text-muted-foreground">ID: {addr.id}</p>
              <p className="text-xs text-muted-foreground">
                {addr.country || "-"} - {addr.city || "-"} - {addr.street || "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                Coordinates: {addr.latitude ?? "-"}, {addr.longitude ?? "-"}
              </p>
            </div>
          ))}
          {departments.length === 0 && <p className="text-sm text-muted-foreground">No departments yet.</p>}
        </div>
      </section>
    </div>
  );
}
