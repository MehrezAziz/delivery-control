import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCS, hasCSRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireCS();

  if (!hasCSRole(auth, "READ_DRIVER_PROFILE")) {
    return NextResponse.json({ error: "You don't have READ_DRIVER_PROFILE permission" }, { status: 403 });
  }

  const drivers = await prisma.driver.findMany({
    include: { user: true },
    orderBy: { user: { createdAt: "desc" } },
    take: 100,
  });

  const data = drivers.map(d => ({
    id: d.id,
    userId: d.user.id,
    firstName: d.user.firstName,
    secondName: d.user.secondName,
    phone: d.user.phone,
    vehicleType: d.vehicleType,
    status: d.status,
    approvedAt: d.approvedAt,
  }));

  return NextResponse.json(data);
}
