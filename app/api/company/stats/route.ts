import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await companyBackendFetch(`/stats${suffix}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load stats";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
