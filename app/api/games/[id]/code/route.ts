import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateSixDigitCode, hashGameCode } from "@/lib/games-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const code = (body.code?.trim() as string) || generateSixDigitCode();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 6 digits" }, { status: 400 });
  }

  const current = await prisma.game.findUnique({
    where: { id },
    select: { accessCodePlain: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const game = await prisma.game.update({
    where: { id },
    data: {
      accessCodeHash: await hashGameCode(code),
      accessCodePlain: code,
      previousAccessCodePlain: current.accessCodePlain ?? null,
      accessCodeVersion: { increment: 1 },
    },
  });

  return NextResponse.json({
    accessCodePlain: code,
    previousAccessCodePlain: (game as unknown as { previousAccessCodePlain: string | null })
      .previousAccessCodePlain ?? null,
    accessCodeVersion: game.accessCodeVersion,
  });
}
