"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";

type Props = {
  initialRuntimeAllowsAi: boolean;
};

export function AiSupportRuntimeToggle({ initialRuntimeAllowsAi }: Props) {
  const [checked, setChecked] = useState(initialRuntimeAllowsAi);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: boolean) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/ai-support/runtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      setChecked(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="ai-runtime"
          type="checkbox"
          className="h-4 w-4 rounded border border-input"
          checked={checked}
          disabled={pending}
          onChange={(e) => void apply(e.target.checked)}
        />
        <Label htmlFor="ai-runtime" className="cursor-pointer font-normal">
          Allow AI replies when backend env and Groq are configured (uncheck to disable without redeploying)
        </Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
