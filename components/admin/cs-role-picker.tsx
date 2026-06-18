"use client";

import { Check } from "lucide-react";
import { CS_ROLE_CATEGORIES, formatCsRole } from "@/lib/cs-roles";

const CATEGORY_ACCENT: Record<string, string> = {
  profiles: "border-sky-200/80 dark:border-sky-800/50 bg-sky-50/50 dark:bg-sky-950/20",
  deliveries: "border-violet-200/80 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20",
  companies: "border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20",
  support: "border-rose-200/80 dark:border-rose-800/50 bg-rose-50/50 dark:bg-rose-950/20",
  finance: "border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20",
};

type Props = {
  selected: string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
};

export function CsRolePicker({ selected, onChange, disabled }: Props) {
  function toggle(role: string) {
    if (disabled) return;
    onChange(selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role]);
  }

  function toggleCategory(categoryRoles: string[], allOn: boolean) {
    if (disabled) return;
    if (allOn) {
      onChange(selected.filter((r) => !categoryRoles.includes(r)));
    } else {
      const merged = new Set([...selected, ...categoryRoles]);
      onChange([...merged]);
    }
  }

  return (
    <div className="space-y-3">
      {CS_ROLE_CATEGORIES.map((category) => {
        const selectedInCategory = category.roles.filter((r) => selected.includes(r)).length;
        const allOn = selectedInCategory === category.roles.length;
        const accent = CATEGORY_ACCENT[category.id] ?? "border-border bg-muted/30";

        return (
          <div key={category.id} className={`rounded-xl border p-4 ${accent}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-semibold">{category.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleCategory(category.roles, allOn)}
                className="text-xs font-medium text-primary hover:underline shrink-0 disabled:opacity-50"
              >
                {allOn ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {category.roles.map((role) => {
                const on = selected.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(role)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                      on
                        ? "border-primary bg-primary/10 text-foreground shadow-sm"
                        : "border-border/80 bg-background/80 hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      }`}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="leading-tight">{formatCsRole(role)}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 tabular-nums">
              {selectedInCategory} / {category.roles.length} selected
            </p>
          </div>
        );
      })}
    </div>
  );
}
