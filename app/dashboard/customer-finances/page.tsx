import { prisma } from "@/lib/prisma";
import CustomerFinancesClient from "./customer-finances-client";

export const dynamic = "force-dynamic";

export default async function CustomerFinancesPage() {
  const wallets = await prisma.digitalWallet.findMany({
    include: {
      customer: {
        include: {
          user: { select: { firstName: true, secondName: true, phone: true } },
          myReferralCode: { select: { code: true } },
        },
      },
      country: { select: { name: true } },
    },
    orderBy: { balance: "desc" },
  });

  const data = wallets.map((w) => ({
    id: w.id,
    customerId: w.customerId,
    balance: Number(w.balance),
    lockedForTransfers: Number(w.lockedForTransfers),
    currency: w.currency,
    discount: Number(w.discount),
    customerName:
      `${w.customer.user.firstName || ""} ${w.customer.user.secondName || ""}`.trim() || "Unknown",
    phone: w.customer.user.phone,
    customerStatus: w.customer.customerStatus,
    referralCode: w.customer.myReferralCode?.code ?? null,
    countryName: w.country.name,
    updatedAt: w.updatedAt.toISOString(),
  }));

  const totalBalance = data.reduce((s, w) => s + w.balance, 0);
  const withBalance = data.filter((w) => w.balance > 0).length;
  const totalLocked = data.reduce((s, w) => s + w.lockedForTransfers, 0);

  return (
    <CustomerFinancesClient
      accounts={data}
      stats={{
        walletCount: data.length,
        withBalance,
        totalBalance,
        totalLocked,
      }}
    />
  );
}
