import { prisma } from "@/lib/prisma";
import CreateCSForm from "./create-cs-form";
import CSTable from "./cs-table";
import { getCsFinancialMaxDays } from "@/lib/cs-financial-policy";

export const dynamic = "force-dynamic";

export default async function CustomerServicePage() {
  const csUsers = await prisma.customerService.findMany({
    include: { superUser: true },
    orderBy: { superUser: { createdAt: "desc" } },
  });
  const maxDaysByCsId = new Map<string, number>();
  await Promise.all(
    csUsers.map(async (cs) => {
      maxDaysByCsId.set(cs.id, await getCsFinancialMaxDays(cs.id));
    }),
  );

  const serialized = csUsers.map(cs => ({
    id: cs.id,
    roles: cs.roles,
    financialAnalyticsMaxDays: maxDaysByCsId.get(cs.id) || 7,
    superUser: {
      id: cs.superUser.id,
      pseudo: cs.superUser.pseudo,
      email: cs.superUser.email,
      telephone: cs.superUser.telephone,
      status: cs.superUser.status,
    },
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Service Management</h1>
      <CreateCSForm />
      <CSTable csUsers={serialized} />
    </div>
  );
}
