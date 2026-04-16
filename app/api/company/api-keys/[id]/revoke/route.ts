import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureMainDepartmentActor } from "@/lib/company-security";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    ensureMainDepartmentActor(auth);
    const { id } = await context.params;
    await prisma.deliveryCompanyApiKey.updateMany({
      where: { id, deliveryCompanyId: auth.companyId },
      data: { status: "REVOKED" },
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to revoke api key";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
