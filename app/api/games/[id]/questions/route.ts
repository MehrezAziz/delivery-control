import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id: gameId } = await params;
  const rows = await prisma.gameQuestion.findMany({
    where: { gameId },
    include: {
      category: true,
      options: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id: gameId } = await params;
  const body = await req.json();
  const row = await prisma.gameQuestion.create({
    data: {
      gameId,
      categoryId: body.categoryId,
      text: body.text ?? null,
      imageUrl: body.imageUrl ?? null,
      isActive: body.isActive ?? true,
      options: {
        create: (body.options ?? []).map(
          (
            o: { text?: string; imageUrl?: string; isCorrect?: boolean; sortOrder?: number },
            i: number,
          ) => ({
            text: o.text ?? null,
            imageUrl: o.imageUrl ?? null,
            isCorrect: !!o.isCorrect,
            sortOrder: o.sortOrder ?? i,
          }),
        ),
      },
    },
    include: { options: true, category: true },
  });
  return NextResponse.json(row);
}
