import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCS, hasCSRole } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCS();
  const { id } = await params;

  if (!hasCSRole(auth, "READ_CUSTOMER_PROFILE")) {
    return NextResponse.json({ error: "You don't have READ_CUSTOMER_PROFILE permission" }, { status: 403 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          addresses: {
            include: {
              delegation: {
                include: { governorate: { include: { country: true } } },
              },
            },
          },
          userRestrictions: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: customer.id,
    userId: customer.user.id,
    firstName: customer.user.firstName,
    secondName: customer.user.secondName,
    phone: customer.user.phone,
    email: customer.user.googleEmail || customer.user.myEmail,
    gender: customer.user.userGender,
    customerStatus: customer.customerStatus,
    completedOrders: customer.completedOrders,
    createdAt: customer.user.createdAt,
    addresses: customer.user.addresses.map(a => ({
      id: a.id,
      street: a.street,
      delegation: a.delegation.nameDelegation,
      governorate: a.delegation.governorate.nameGovernorate,
      country: a.delegation.governorate.country.name,
      latitude: a.latitude,
      longitude: a.longitude,
    })),
    restrictions: customer.user.userRestrictions.map(r => ({
      id: r.id,
      type: r.type,
      reason: r.reason,
      startDate: r.startDate,
      endDate: r.endDate,
      liftedAt: r.liftedAt,
    })),
  });
}
