import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const cs = await prisma.customerService.findUnique({
      where: { id },
      include: {
        governorates: {
          include: { governorate: { include: { country: { select: { id: true, name: true } } } } },
        },
        superUser: { select: { pseudo: true } },
      },
    });
    if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      customerServiceId: cs.id,
      pseudo: cs.superUser.pseudo,
      governorates: cs.governorates.map((g) => ({
        id: g.governorate.id,
        name: g.governorate.nameGovernorate,
        countryId: g.governorate.country.id,
        countryName: g.governorate.country.name,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const ids: unknown = body?.governorateIds;
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
      return NextResponse.json({ error: "governorateIds must be an array of strings" }, { status: 400 });
    }
    const governorateIds = [...new Set(ids as string[])];

    const cs = await prisma.customerService.findUnique({ where: { id } });
    if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.customerServiceGovernorate.deleteMany({ where: { customerServiceId: id } }),
      ...(governorateIds.length
        ? [
            prisma.customerServiceGovernorate.createMany({
              data: governorateIds.map((governorateId) => ({ customerServiceId: id, governorateId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: "ADMIN",
        actionType: "UPDATE_CS_GOVERNORATES",
        targetType: "CUSTOMER_SERVICE",
        targetId: id,
        newValue: JSON.stringify({ count: governorateIds.length }),
      });
    } catch {}

    return NextResponse.json({ ok: true, count: governorateIds.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
