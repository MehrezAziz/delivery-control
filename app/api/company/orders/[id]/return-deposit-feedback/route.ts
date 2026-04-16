import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await req.text();
    const res = await companyBackendFetch(`/orders/${id}/return-deposit-feedback`, {
      method: "POST",
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to submit return feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
