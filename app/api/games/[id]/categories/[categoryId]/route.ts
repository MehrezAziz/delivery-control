import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string; categoryId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id: gameId, categoryId } = await params;
  const body = await req.json();
  const row = await prisma.gameCategory.update({
    where: { id: categoryId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
  });
  if (row.gameId !== gameId) {
    return NextResponse.json({ error: "Mismatched game" }, { status: 400 });
  }
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id: gameId, categoryId } = await params;
  const cat = await prisma.gameCategory.findUnique({ where: { id: categoryId } });
  if (!cat || cat.gameId !== gameId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const qCount = await prisma.gameQuestion.count({ where: { categoryId } });
  if (qCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${qCount} question(s) still use this category. Deactivate it instead, or move/delete its questions first.` },
      { status: 400 },
    );
  }
  await prisma.gameCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ ok: true });
}
