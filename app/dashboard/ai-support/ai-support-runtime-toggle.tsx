"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Bot, Power } from "lucide-react";

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
    <div className="space-y-4">
      <div
        className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          checked
            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            : "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              checked ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40"
            }`}
          >
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">AI replies runtime</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Allow AI replies when backend env and Groq are configured. Uncheck to disable without redeploying.
            </p>
            <Badge
              variant="outline"
              className={`mt-2 ${
                checked
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              <Power className="h-3 w-3 mr-1" />
              {checked ? "AI enabled (runtime)" : "AI disabled (runtime)"}
            </Badge>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 shrink-0">
          <input
            id="ai-runtime"
            type="checkbox"
            className="h-5 w-5 rounded border border-input accent-fuchsia-600"
            checked={checked}
            disabled={pending}
            onChange={(e) => void apply(e.target.checked)}
          />
          <Label htmlFor="ai-runtime" className="cursor-pointer font-normal text-sm">
            {pending ? "Saving…" : checked ? "Enabled" : "Disabled"}
          </Label>
        </label>
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
