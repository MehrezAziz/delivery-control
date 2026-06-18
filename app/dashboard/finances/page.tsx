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

  const data = accounts.map((da) => ({
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

  const totalNegative = data.filter((d) => d.balance < 0).reduce((s, d) => s + d.balance, 0);
  const totalPositive = data.filter((d) => d.balance > 0).reduce((s, d) => s + d.balance, 0);
  const inDebt = data.filter((d) => d.balance < 0).length;

  return (
    <FinancesClient
      accounts={data}
      stats={{
        totalDrivers: data.length,
        inDebt,
        totalDebt: totalNegative,
        totalCredit: totalPositive,
      }}
    />
  );
}
