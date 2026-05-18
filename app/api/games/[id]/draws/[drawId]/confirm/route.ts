import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { finalizeDrawWinners } from "@/lib/games-admin";

type Params = { params: Promise<{ id: string; drawId: string }> };

export async function POST(_req: Request, { params }: Params) {
  await requireAdmin();
  const { drawId } = await params;
  await finalizeDrawWinners(drawId);
  return NextResponse.json({ ok: true });
}
