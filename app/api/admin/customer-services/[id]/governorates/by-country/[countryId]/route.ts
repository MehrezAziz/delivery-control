import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

/** Merge all governorates of a country into this CS account (existing assignments kept). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; countryId: string }> },
) {
  try {
    const auth = await requireAdmin();
    const { id, countryId } = await params;

    const cs = await prisma.customerService.findUnique({ where: { id } });
    if (!cs) return NextResponse.json({ error: "CS not found" }, { status: 404 });

    const govRows = await prisma.governorate.findMany({
      where: { countryId },
      select: { id: true },
    });
    if (govRows.length === 0) {
      return NextResponse.json({ error: "No governorates for this country" }, { status: 404 });
    }

    await prisma.customerServiceGovernorate.createMany({
      data: govRows.map((g) => ({ customerServiceId: id, governorateId: g.id })),
      skipDuplicates: true,
    });

    const count = await prisma.customerServiceGovernorate.count({ where: { customerServiceId: id } });

    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: "ADMIN",
        actionType: "UPDATE_CS_GOVERNORATES_BY_COUNTRY",
        targetType: "CUSTOMER_SERVICE",
        targetId: id,
        newValue: JSON.stringify({ countryId, added: govRows.length, totalLinks: count }),
      });
    } catch {}

    return NextResponse.json({ ok: true, added: govRows.length, totalLinks: count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
