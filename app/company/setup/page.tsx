"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

export default function CompanySetupPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [iban, setIban] = useState("");
  const [rib, setRib] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankId, setBankId] = useState<string | null>(null);
  const [bankEditMode, setBankEditMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/company/onboarding");
      const data = await res.json();
      if (res.ok) {
        setCompleted(!!data.onboardingCompleted);
        const bank = Array.isArray(data.bankAccounts) ? data.bankAccounts[0] : null;
        if (bank) {
          setBankId(bank.id);
          setAccountHolderName(bank.accountHolderName || "");
          setIban(bank.iban || "");
          setRib(bank.rib || "");
          setBankName(bank.bankName || "");
        }
      }
    };
    void load();
  }, []);

  const save = async () => {
    setMessage(null);
    const res = await fetch("/api/company/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldPassword: oldPassword || undefined,
        password: password || undefined,
        bankAccount: accountHolderName
          ? { id: bankId || undefined, accountHolderName, iban, rib, bankName }
          : undefined,
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
        <input className="w-full rounded-md border px-3 py-2" type="password" placeholder="Old password (required for change)" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </section>
      <p className="text-sm text-muted-foreground">
        Create your first department on the{" "}
        <Link href="/company/departments" className="font-medium text-foreground underline">
          Departments
        </Link>{" "}
        page. The first department you add becomes the main and default location for the company.
      </p>
      <section className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bank account</h2>
          {bankId && (
            <button className="rounded-md border p-2" onClick={() => setBankEditMode((v) => !v)} title="Edit bank account">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        {bankId && !bankEditMode ? (
          <div className="rounded-md border bg-muted p-3 text-sm">
            <p>Account holder: {accountHolderName || "-"}</p>
            <p>IBAN: {iban || "-"}</p>
            <p>RIB: {rib || "-"}</p>
            <p>Bank: {bankName || "-"}</p>
          </div>
        ) : (
          <>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Account holder name" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="RIB" value={rib} onChange={(e) => setRib(e.target.value)} />
            <input className="w-full rounded-md border px-3 py-2" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </>
        )}
      </section>
      <button className="rounded-md bg-primary px-3 py-2 text-primary-foreground" onClick={save}>Save Setup</button>
    </div>
  );
}
