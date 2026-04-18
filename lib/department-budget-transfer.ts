/**
 * Shared company → department budget wallet transfer (same economics as manual POST /budget-transfer).
 * Returns updated company balance and department wallet available balance.
 */
export async function transferCompanyCoinsToDepartmentBudgetWallet(
  tx: {
    deliveryCompany: {
      findUnique: (args: unknown) => Promise<{ coinBalance: unknown; lockedCoins: unknown } | null>;
      update: (args: unknown) => Promise<unknown>;
    };
    deliveryCompanyDepartmentBudgetWallet: {
      upsert: (args: unknown) => Promise<{ availableCoins: unknown }>;
    };
    deliveryCompanyTransaction: { create: (args: unknown) => Promise<unknown> };
  },
  params: {
    companyId: string;
    departmentId: string;
    amountCoins: number;
    /** Shown on the company ledger line */
    description: string;
  },
): Promise<{ newCompanyBalance: number; walletAvailable: number }> {
  const { companyId, departmentId, amountCoins, description } = params;
  if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
    throw new Error("Invalid amountCoins");
  }

  const company = await tx.deliveryCompany.findUnique({
    where: { id: companyId },
    select: { coinBalance: true, lockedCoins: true },
  });
  if (!company) throw new Error("Company not found");
  const available = Number(company.coinBalance) - Number(company.lockedCoins || 0);
  if (available < amountCoins) throw new Error("Insufficient company available balance");

  const wallet = await tx.deliveryCompanyDepartmentBudgetWallet.upsert({
    where: { departmentId },
    create: {
      deliveryCompanyId: companyId,
      departmentId,
      availableCoins: amountCoins,
    },
    update: {
      availableCoins: { increment: amountCoins },
    },
  });

  const newCompanyBalance = Number(company.coinBalance) - amountCoins;
  await tx.deliveryCompany.update({
    where: { id: companyId },
    data: { coinBalance: newCompanyBalance },
  });
  await tx.deliveryCompanyTransaction.create({
    data: {
      deliveryCompanyId: companyId,
      type: "DEPARTMENT_BUDGET_ALLOC",
      amount: -amountCoins,
      balanceAfter: newCompanyBalance,
      description,
    },
  });

  return { newCompanyBalance, walletAvailable: Number(wallet.availableCoins) };
}
