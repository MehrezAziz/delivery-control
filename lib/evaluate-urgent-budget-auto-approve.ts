import { buildUrgentAutoDenialNote } from "@/lib/urgent-budget-auto-approve";

type Priority = "NORMAL" | "URGENT";

/** Shared policy + balance check for creating or updating an urgent budget request (POST / PATCH). */
export async function evaluateUrgentBudgetAutoApprove(
  db: any,
  input: {
    companyId: string;
    departmentAccountId: string | null | undefined;
    amountCoins: number;
    priorityEnum: Priority;
    /** When editing a row, exclude it from the rolling urgent sum. */
    excludeRequestId?: string;
  },
): Promise<{
  canUrgentAutoApprove: boolean;
  urgentDenialNote: string | null;
  policy: Record<string, unknown> | null;
  company: { coinBalance: unknown; lockedCoins: unknown } | null;
  availableCompany: number;
  existingUrgentSum: number;
}> {
  const { companyId, departmentAccountId, amountCoins, priorityEnum, excludeRequestId } = input;
  const isUrgent = priorityEnum === "URGENT";

  const policy = departmentAccountId
    ? await db.deliveryCompanyDepartmentBudgetPolicy.findUnique({
        where: { departmentAccountId },
      })
    : null;

  const company = await db.deliveryCompany.findUnique({
    where: { id: companyId },
    select: { coinBalance: true, lockedCoins: true },
  });
  const availableCompany = company
    ? Number(company.coinBalance) - Number(company.lockedCoins || 0)
    : 0;

  const minHours = policy ? Number(policy.minHoursBetweenReq || 0) : 0;
  const maxCap = policy ? Number(policy.maxAutoApproveAmount || 0) : 0;

  let existingUrgentSum = 0;
  if (isUrgent && departmentAccountId && minHours > 0) {
    const windowStart = new Date(Date.now() - minHours * 3600 * 1000);
    const agg = await db.deliveryCompanyDepartmentBudgetRequest.aggregate({
      where: {
        deliveryCompanyId: companyId,
        requestedByAccountId: departmentAccountId,
        priority: "URGENT",
        status: { notIn: ["REJECTED", "CANCELLED"] },
        createdAt: { gte: windowStart },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      _sum: { amountCoins: true },
    });
    existingUrgentSum = Number(agg._sum.amountCoins ?? 0);
  }

  const capOk = !isUrgent || minHours <= 0 ? amountCoins <= maxCap : existingUrgentSum + amountCoins <= maxCap + 1e-9;

  const canUrgentAutoApprove =
    isUrgent &&
    !!policy?.isActive &&
    !!policy?.isAutoApproveEnabled &&
    !!policy &&
    capOk &&
    availableCompany >= amountCoins;

  let urgentDenialNote: string | null = null;
  if (isUrgent && !canUrgentAutoApprove) {
    urgentDenialNote = buildUrgentAutoDenialNote({
      hasPolicy: !!policy,
      policyActive: !!policy?.isActive,
      autoEnabled: !!policy?.isAutoApproveEnabled,
      maxCap,
      minHours,
      existingUrgentSum,
      requestedAmount: amountCoins,
      availableCompany,
    });
  }

  return {
    canUrgentAutoApprove,
    urgentDenialNote,
    policy,
    company,
    availableCompany,
    existingUrgentSum,
  };
}
