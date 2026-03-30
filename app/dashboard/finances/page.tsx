import { prisma } from "@/lib/prisma";
import FinancesClient from "./finances-client";

export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const accounts = await prisma.driverAccount.findMany({
    include: {
      driver: {
        include: {
          user: { select: { firstName: true, secondName: true, phone: true } },
        },
      },
    },
    orderBy: { balance: "asc" },
  });

  const data = accounts.map(da => ({
    id: da.id,
    driverId: da.driver.id,
    balance: Number(da.balance),
    currency: da.currency,
    completedDeliveries: da.completedDeliveries,
    driverName: `${da.driver.user.firstName || ""} ${da.driver.user.secondName || ""}`.trim() || "Unknown",
    phone: da.driver.user.phone,
    driverStatus: da.driver.status,
    createdAt: da.createdAt.toISOString(),
  }));

  const totalNegative = data.filter(d => d.balance < 0).reduce((s, d) => s + d.balance, 0);
  const totalPositive = data.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Driver Finances</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Drivers</p>
          <p className="text-2xl font-bold">{data.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Debt (negative balances)</p>
          <p className="text-2xl font-bold text-red-600">{totalNegative.toFixed(2)} TND</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Credit (positive balances)</p>
          <p className="text-2xl font-bold text-green-600">{totalPositive.toFixed(2)} TND</p>
        </div>
      </div>

      <FinancesClient accounts={data} />
    </div>
  );
}
