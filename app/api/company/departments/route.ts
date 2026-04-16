import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await companyBackendFetch("/departments", { method: "POST", body });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create department";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
