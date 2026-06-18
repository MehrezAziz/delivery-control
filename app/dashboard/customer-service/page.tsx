import { prisma } from "@/lib/prisma";
import CreateCSForm from "./create-cs-form";
import CSTable from "./cs-table";
import { getCsFinancialMaxDays } from "@/lib/cs-financial-policy";
import { Headphones, Users, ShieldCheck, Activity } from "lucide-react";

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

  const serialized = csUsers.map((cs) => ({
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

  const activeCount = serialized.filter((cs) => cs.superUser.status === "ACTIVE").length;
  const totalPermissions = serialized.reduce((sum, cs) => sum + cs.roles.length, 0);

  return (
    <div className="min-h-full bg-gradient-to-b from-teal-50/70 via-background to-background dark:from-teal-950/15">
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-teal-600 via-cyan-600 to-sky-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="relative p-6 sm:p-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Headphones className="h-3.5 w-3.5" />
              Support team administration
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Customer Service Management</h1>
            <p className="text-teal-100 text-sm max-w-2xl">
              Create agent accounts, assign permissions by category, set geographic coverage, and
              control analytics access ranges.
            </p>
          </div>

          {serialized.length > 0 && (
            <div className="relative border-t border-white/20 grid grid-cols-3 divide-x divide-white/20">
              <div className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-teal-100 text-xs mb-1">
                  <Users className="h-3.5 w-3.5" />
                  Accounts
                </div>
                <div className="text-2xl font-bold tabular-nums">{serialized.length}</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-teal-100 text-xs mb-1">
                  <Activity className="h-3.5 w-3.5" />
                  Active
                </div>
                <div className="text-2xl font-bold tabular-nums">{activeCount}</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-teal-100 text-xs mb-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Permissions
                </div>
                <div className="text-2xl font-bold tabular-nums">{totalPermissions}</div>
              </div>
            </div>
          )}
        </div>

        <CreateCSForm />
        <CSTable csUsers={serialized} />
      </div>
    </div>
  );
}
