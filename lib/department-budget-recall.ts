/**
 * Move coins from a department budget wallet back to the company wallet (main company action).
 * Persists one ledger line: DEPARTMENT_BUDGET_RETURN with positive amount (credit to company).
 * Description includes an explicit "−X" reference for department-budget semantics.
 */
export async function recallDepartmentBudgetWalletToCompany(
  tx: {
    deliveryCompany: {
      findUnique: (args: unknown) => Promise<{ coinBalance: unknown } | null>;
      update: (args: unknown) => Promise<unknown>;
    };
    deliveryCompanyDepartmentBudgetWallet: {
      findUnique: (args: unknown) => Promise<{ availableCoins: unknown } | null>;
      update: (args: unknown) => Promise<{ availableCoins: unknown }>;
    };
    deliveryCompanyTransaction: { create: (args: unknown) => Promise<unknown> };
  },
  params: {
    companyId: string;
    departmentId: string;
    departmentLabel?: string;
    amountCoins: number;
  },
): Promise<{ newCompanyBalance: number; walletAvailable: number }> {
  const { companyId, departmentId, amountCoins, departmentLabel } = params;
  if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
    throw new Error("Invalid amountCoins");
  }

  const wallet = await tx.deliveryCompanyDepartmentBudgetWallet.findUnique({
    where: { departmentId },
    select: { availableCoins: true },
  });
  if (!wallet) throw new Error("Department budget wallet not found");
  const availableDept = Number(wallet.availableCoins || 0);
  if (availableDept < amountCoins) {
    throw new Error("Insufficient department budget balance");
  }

  const company = await tx.deliveryCompany.findUnique({
    where: { id: companyId },
    select: { coinBalance: true },
  });
  if (!company) throw new Error("Company not found");

  const newCompanyBalance = Number(company.coinBalance) + amountCoins;
  await tx.deliveryCompany.update({
    where: { id: companyId },
    data: { coinBalance: newCompanyBalance },
  });

  const updatedWallet = await tx.deliveryCompanyDepartmentBudgetWallet.update({
    where: { departmentId },
    data: { availableCoins: { decrement: amountCoins } },
  });

  const label = departmentLabel?.trim() || departmentId;
  await tx.deliveryCompanyTransaction.create({
    data: {
      deliveryCompanyId: companyId,
      type: "DEPARTMENT_BUDGET_RETURN",
      amount: amountCoins,
      balanceAfter: newCompanyBalance,
      description: `Recall from department budget (${label}): +${amountCoins.toFixed(2)} to company wallet (equivalent to −${amountCoins.toFixed(2)} from department budget)`,
    },
  });

  return { newCompanyBalance, walletAvailable: Number(updatedWallet.availableCoins) };
}
