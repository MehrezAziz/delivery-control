import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string; questionId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id: gameId, questionId } = await params;
  const body = await req.json();

  const question = await prisma.gameQuestion.findUnique({ where: { id: questionId } });
  if (!question || question.gameId !== gameId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (Array.isArray(body.options)) {
    await prisma.gameQuestionOption.deleteMany({ where: { questionId } });
    await prisma.gameQuestionOption.createMany({
      data: body.options.map(
        (
          o: { text?: string; imageUrl?: string; isCorrect?: boolean; sortOrder?: number },
          i: number,
        ) => ({
          questionId,
          text: o.text ?? null,
          imageUrl: o.imageUrl ?? null,
          isCorrect: !!o.isCorrect,
          sortOrder: o.sortOrder ?? i,
        }),
      ),
    });
  }

  const updated = await prisma.gameQuestion.update({
    where: { id: questionId },
    data: {
      ...(body.text !== undefined ? { text: body.text } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: { options: { orderBy: { sortOrder: "asc" } }, category: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id: gameId, questionId } = await params;
  const question = await prisma.gameQuestion.findUnique({ where: { id: questionId } });
  if (!question || question.gameId !== gameId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.gameQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}
