import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "MANAGE_DELIVERY_COMPANY")) {
      return NextResponse.json({ error: "Insufficient permissions: MANAGE_DELIVERY_COMPANY required" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const rawKey = `dck_${randomBytes(20).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const created = await prisma.deliveryCompanyApiKey.create({
      data: {
        deliveryCompanyId: id,
        name: body.name,
        keyPrefix,
        keyHash,
        scopes: body.scopes || ["orders:read", "orders:write", "wallet:read", "refunds:write"],
      },
    });
    return NextResponse.json({ ...created, rawKey }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create api key";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
