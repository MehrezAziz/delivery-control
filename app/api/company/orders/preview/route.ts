import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await companyBackendFetch("/orders/preview", { method: "POST", body });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to preview order";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
