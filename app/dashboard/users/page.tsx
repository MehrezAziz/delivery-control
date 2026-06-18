import { prisma } from "@/lib/prisma";
import { UsersAdminClient } from "./users-admin-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [customers, drivers] = await Promise.all([
    prisma.customer.findMany({
      include: { user: true },
      orderBy: { user: { createdAt: "desc" } },
      take: 100,
    }),
    prisma.driver.findMany({
      include: { user: true },
      orderBy: { user: { createdAt: "desc" } },
      take: 100,
    }),
  ]);

  const customerRows = customers.map((c) => ({
    id: c.id,
    userId: c.user.id,
    firstName: c.user.firstName ?? "",
    secondName: c.user.secondName ?? "",
    phone: c.user.phone,
    email: c.user.googleEmail || c.user.myEmail,
    customerStatus: c.customerStatus,
    completedOrders: c.completedOrders,
    createdAt: c.user.createdAt.toISOString(),
  }));

  const driverRows = drivers.map((d) => ({
    id: d.id,
    userId: d.user.id,
    firstName: d.user.firstName ?? "",
    secondName: d.user.secondName ?? "",
    phone: d.user.phone,
    vehicleType: d.vehicleType,
    status: d.status,
    createdAt: d.user.createdAt.toISOString(),
  }));

  return <UsersAdminClient customers={customerRows} drivers={driverRows} />;
}
