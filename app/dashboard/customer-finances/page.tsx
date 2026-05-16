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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Finances</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Customers with wallets</p>
          <p className="text-2xl font-bold">{data.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Customers with balance</p>
          <p className="text-2xl font-bold text-green-600">{withBalance}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total coins in wallets</p>
          <p className="text-2xl font-bold">{totalBalance.toFixed(2)}</p>
        </div>
      </div>

      <CustomerFinancesClient accounts={data} />
    </div>
  );
}
