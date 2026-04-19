import { NextRequest, NextResponse } from "next/server";

function backendBase() {
  return (process.env.DELIVERY_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Public proxy: live driver position for map (no company auth). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    const res = await fetch(`${backendBase()}/api/tracking/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upstream error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
