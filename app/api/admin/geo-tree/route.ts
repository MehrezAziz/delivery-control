import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Countries with governorates for CS coverage UI. */
export async function GET() {
  try {
    await requireAdmin();
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        governorates: { orderBy: { nameGovernorate: "asc" }, select: { id: true, nameGovernorate: true } },
      },
    });
    return NextResponse.json({ countries });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
