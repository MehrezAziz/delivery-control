import { NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureCompanyRoleAllowed } from "@/lib/company-security";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN", "DEPT_ADMIN", "DEPT_OPERATOR"]);
    const { id } = await params;
    const payload = await req.json();
    const res = await companyBackendFetch(`/orders/${id}/chat/messages`, {
      method: "POST",
      body: JSON.stringify({ content: payload?.content || "" }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to send message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
