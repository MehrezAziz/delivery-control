/** Three decimal places, rounding up (e.g. 10.3751 → 10.376). */
export function formatCoinsCeil3(n: number | string | null | undefined): string {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.000";
  return (Math.ceil(x * 1000) / 1000).toFixed(3);
}
