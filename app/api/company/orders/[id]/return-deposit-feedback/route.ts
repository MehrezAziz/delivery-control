import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed } from "@/lib/company-security";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    const { id } = await context.params;
    const body = await req.text();

    const idemKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idemKey) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }

    const res = await companyBackendFetch(`/orders/${id}/return-deposit-feedback`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idemKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to submit return feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
