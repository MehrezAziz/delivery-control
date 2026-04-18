/** Normalize client/UI priority to enum value. */
export function normalizeBudgetRequestPriority(raw: unknown): "NORMAL" | "URGENT" {
  const p = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (p === "URGENT") return "URGENT";
  return "NORMAL";
}

export type UrgentAutoDenialContext = {
  hasPolicy: boolean;
  policyActive: boolean;
  autoEnabled: boolean;
  maxCap: number;
  minHours: number;
  existingUrgentSum: number;
  requestedAmount: number;
  availableCompany: number;
};

export function buildUrgentAutoDenialNote(ctx: UrgentAutoDenialContext): string {
  if (!ctx.hasPolicy) {
    return "No budget policy is configured for this department account. Ask the company main admin to add one.";
  }
  if (!ctx.policyActive) {
    return "Budget policy exists but is inactive.";
  }
  if (!ctx.autoEnabled) {
    return "Budget policy has automatic approval for urgent requests turned off.";
  }
  if (ctx.availableCompany < ctx.requestedAmount) {
    return `Company available balance (${ctx.availableCompany.toFixed(2)} coins) is less than this request (${ctx.requestedAmount.toFixed(2)} coins).`;
  }
  const projected = ctx.existingUrgentSum + ctx.requestedAmount;
  if (projected > ctx.maxCap + 1e-9) {
    if (ctx.minHours <= 0) {
      return `This urgent request (${ctx.requestedAmount.toFixed(2)} coins) exceeds the policy maximum (${ctx.maxCap.toFixed(2)} coins) for automatic approval.`;
    }
    return (
      `Rolling urgent budget cap: in the last ${ctx.minHours} hour(s), other urgent requests total ${ctx.existingUrgentSum.toFixed(2)} coins; ` +
      `with this ${ctx.requestedAmount.toFixed(2)} coins the total would be ${projected.toFixed(2)} coins, above the allowed ${ctx.maxCap.toFixed(2)} coins. ` +
      `Wait until older urgent amounts age out of the window, or ask main admin to raise the cap.`
    );
  }
  return "Urgent request did not qualify for automatic approval (check policy and balances).";
}
