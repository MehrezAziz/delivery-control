import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

export async function GET() {
  try {
    await requireCompanyAuth();
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        governorates: {
          orderBy: { nameGovernorate: "asc" },
          include: {
            delegations: {
              orderBy: { nameDelegation: "asc" },
              select: { id: true, nameDelegation: true },
            },
          },
        },
      },
    });
    return NextResponse.json({ countries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load geo data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
