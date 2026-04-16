"use client";

import { useEffect, useState } from "react";

export default function CompanySetupPage() {
  const [password, setPassword] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [iban, setIban] = useState("");
  const [rib, setRib] = useState("");
  const [bankName, setBankName] = useState("");
  const [destination, setDestination] = useState("BANK_TRANSFER");
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [departmentLabel, setDepartmentLabel] = useState("");
  const [departmentCity, setDepartmentCity] = useState("");
  const [departmentCountry, setDepartmentCountry] = useState("");

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/company/onboarding");
      const data = await res.json();
      if (res.ok) setCompleted(!!data.onboardingCompleted);
    };
    void load();
  }, []);

  const save = async () => {
    setMessage(null);
    const res = await fetch("/api/company/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: password || undefined,
        defaultRefundDestinationType: destination,
        departmentLabel: departmentLabel || undefined,
        departmentCity: departmentCity || undefined,
        departmentCountry: departmentCountry || undefined,
        bankAccount: accountHolderName ? { accountHolderName, iban, rib, bankName } : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data?.error || "Failed to save setup");
    setCompleted(true);
    setMessage("Setup saved successfully.");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Company Setup Wizard</h1>
      {completed && <div className="rounded-md border bg-muted px-3 py-2 text-sm">Onboarding is completed.</div>}
      {message && <div className="rounded-md border bg-muted px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">Security</h2>
        <input className="w-full rounded-md border px-3 py-2" type="password" placeholder="Set/update company password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </section>
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">First Department</h2>
        <input className="w-full rounded-md border px-3 py-2" placeholder="Department label" value={departmentLabel} onChange={(e) => setDepartmentLabel(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" placeholder="Department city" value={departmentCity} onChange={(e) => setDepartmentCity(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" placeholder="Department country" value={departmentCountry} onChange={(e) => setDepartmentCountry(e.target.value)} />
      </section>
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">Bank account</h2>
        <input className="w-full rounded-md border px-3 py-2" placeholder="Account holder name" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" placeholder="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" placeholder="RIB" value={rib} onChange={(e) => setRib(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
      </section>
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="text-lg font-semibold">Refund preferences</h2>
        <select className="w-full rounded-md border px-3 py-2" value={destination} onChange={(e) => setDestination(e.target.value)}>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CARD_REFUND">Card refund</option>
        </select>
      </section>
      <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={save}>Save Setup</button>
    </div>
  );
}
