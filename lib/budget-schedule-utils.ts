export type BudgetCadence = "DAILY" | "WEEKLY" | "MONTHLY";

/** Advance a scheduled run instant by one cadence step (anchor is the previous `nextRunAt`). */
export function computeNextRunAfter(fromRunAt: Date, cadence: BudgetCadence): Date {
  const d = new Date(fromRunAt.getTime());
  if (cadence === "DAILY") {
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (cadence === "WEEKLY") {
    d.setUTCDate(d.getUTCDate() + 7);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

/** Default first run if caller did not pass `firstRunAt` (UTC calendar-aligned). */
export function defaultFirstNextRunAt(cadence: BudgetCadence): Date {
  const now = new Date();
  if (cadence === "DAILY") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    return d;
  }
  if (cadence === "WEEKLY") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const day = d.getUTCDay();
    const daysUntilMon = (8 - day) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + daysUntilMon);
    return d;
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}
