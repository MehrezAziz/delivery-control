import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runDueDrawsForGame } from "@/lib/games-draw-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  await requireAdmin();
  const { id } = await params;
  try {
    const results = await runDueDrawsForGame(id);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Draw failed" },
      { status: 500 },
    );
  }
}
