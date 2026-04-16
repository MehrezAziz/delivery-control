import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { signCompanyToken } from "@/lib/company-auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const db: any = prisma;
    const { email, password, companyId, apiKey } = await req.json();

    let resolvedCompanyId = "";
    let resolvedCompanyName = "";
    let resolvedApiKey = "";

    if (email && password) {
      const company = await db.deliveryCompany.findFirst({
        where: { contactEmail: String(email) },
      });
      if (!company || !company.passwordHash) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
      if (company.status !== "ACTIVE") {
        return NextResponse.json(
          { error: `Company account is ${company.status}. Ask admin to set status ACTIVE.` },
          { status: 403 },
        );
      }
      const valid = await bcrypt.compare(String(password), company.passwordHash);
      if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      const rawKey = `dck_${randomBytes(20).toString("hex")}`;
      const keyPrefix = rawKey.slice(0, 12);
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      await db.deliveryCompanyApiKey.create({
        data: {
          deliveryCompanyId: company.id,
          name: "web-session",
          keyPrefix,
          keyHash,
          scopes: [
            "orders:read",
            "orders:write",
            "wallet:read",
            "refunds:read",
            "refunds:write",
            "departments:write",
            "departments:read",
          ],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      resolvedCompanyId = company.id;
      resolvedCompanyName = company.name;
      resolvedApiKey = rawKey;
    } else if (companyId && apiKey) {
      const keyPrefix = String(apiKey).slice(0, 12);
      const keyHash = createHash("sha256").update(String(apiKey)).digest("hex");
      const row = await db.deliveryCompanyApiKey.findFirst({
        where: {
          deliveryCompanyId: companyId,
          keyPrefix,
          keyHash,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { deliveryCompany: true },
      });
      if (!row || row.deliveryCompany.status !== "ACTIVE") {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
      await db.deliveryCompanyApiKey.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      });
      resolvedCompanyId = row.deliveryCompanyId;
      resolvedCompanyName = row.deliveryCompany.name;
      resolvedApiKey = String(apiKey);
    } else {
      return NextResponse.json(
        { error: "Use either email+password or companyId+apiKey" },
        { status: 400 },
      );
    }

    const token = await signCompanyToken({
      companyId: resolvedCompanyId,
      companyName: resolvedCompanyName,
      apiKey: resolvedApiKey,
    });
    await db.deliveryCompanyAuditLog.create({
      data: {
        deliveryCompanyId: resolvedCompanyId,
        actionType: "COMPANY_LOGIN",
        actorType: "COMPANY",
      },
    });
    const response = NextResponse.json({ success: true });
    response.cookies.set("company_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
