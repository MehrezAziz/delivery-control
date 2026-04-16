import { NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";

export async function GET() {
  try {
    const res = await companyBackendFetch("/profile");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
