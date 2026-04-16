import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

export async function GET() {
  try {
    const auth = await requireCompanyAuth();
    const keys = await prisma.deliveryCompanyApiKey.findMany({
      where: { deliveryCompanyId: auth.companyId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(keys);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load api keys";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCompanyAuth();
    const body = await req.json();
    const rawKey = `dck_${randomBytes(20).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const created = await prisma.deliveryCompanyApiKey.create({
      data: {
        deliveryCompanyId: auth.companyId,
        name: body?.name || "company-key",
        keyPrefix,
        keyHash,
        scopes: body?.scopes || ["orders:read", "orders:write", "wallet:read", "refunds:read", "refunds:write"],
      },
    });
    return NextResponse.json({ ...created, rawKey }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create api key";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
