import type { AdminPayload } from "@/lib/auth";
import { hasCSRole } from "@/lib/auth";

/** Admin always; CS needs PROCESS_WITHDRAWALS or MANAGE_FINANCIAL_REPORTS */
export function canProcessFiatWithdrawals(auth: AdminPayload): boolean {
  if (auth.role === "ADMIN") return true;
  return (
    hasCSRole(auth, "PROCESS_WITHDRAWALS") || hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS")
  );
}
