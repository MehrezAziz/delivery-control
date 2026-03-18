import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCS, hasCSRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireCS();

  if (!hasCSRole(auth, "READ_CUSTOMER_PROFILE")) {
    return NextResponse.json({ error: "You don't have READ_CUSTOMER_PROFILE permission" }, { status: 403 });
  }

  const customers = await prisma.customer.findMany({
    include: { user: true },
    orderBy: { user: { createdAt: "desc" } },
    take: 100,
  });

  const data = customers.map(c => ({
    id: c.id,
    userId: c.user.id,
    firstName: c.user.firstName,
    secondName: c.user.secondName,
    phone: c.user.phone,
    email: c.user.googleEmail || c.user.myEmail,
    customerStatus: c.customerStatus,
    completedOrders: c.completedOrders,
  }));

  return NextResponse.json(data);
}
