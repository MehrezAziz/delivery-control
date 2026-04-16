import { NextRequest, NextResponse } from "next/server";
import { companyBackendFetch } from "@/lib/company-api";
import { requireCompanyAuth } from "@/lib/company-auth";
import { prisma } from "@/lib/prisma";
import { ensureMainDepartmentActor } from "@/lib/company-security";
import { enforceCompanyRateLimit } from "@/lib/company-rate-limit";

export async function GET() {
  try {
    const res = await companyBackendFetch("/refund-requests");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load refund requests";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    ensureMainDepartmentActor(auth);
    const idempotencyKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 });
    }
    enforceCompanyRateLimit(
      ["company-refund-create", auth.companyId, auth.departmentId || "main", auth.actorRole || "MAIN_ADMIN"],
      10,
      60_000,
    );
    const parsed = await req.json();
    const amount = Number(parsed?.amountCoins || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
    }
    const company = await prisma.deliveryCompany.findUnique({
      where: { id: auth.companyId },
      select: { coinBalance: true, lockedCoins: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    const availableAfterFees = Number(company.coinBalance) - Number(company.lockedCoins || 0);
    if (amount > availableAfterFees) {
      return NextResponse.json(
        { error: `Refund exceeds available balance (${availableAfterFees.toFixed(2)} coins)` },
        { status: 400 },
      );
    }

    const res = await companyBackendFetch("/refund-requests", {
      method: "POST",
      body: JSON.stringify(parsed),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create refund request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
