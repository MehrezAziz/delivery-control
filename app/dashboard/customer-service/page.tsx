import { prisma } from "@/lib/prisma";
import CreateCSForm from "./create-cs-form";
import CSTable from "./cs-table";

export const dynamic = "force-dynamic";

export default async function CustomerServicePage() {
  const csUsers = await prisma.customerService.findMany({
    include: { superUser: true },
    orderBy: { superUser: { createdAt: "desc" } },
  });

  const serialized = csUsers.map(cs => ({
    id: cs.id,
    roles: cs.roles,
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
