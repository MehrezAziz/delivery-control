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
    let actorRole: "MAIN_ADMIN" | "DEPT_ADMIN" | "DEPT_OPERATOR" | "DEPT_VIEWER" = "MAIN_ADMIN";
    let departmentId: string | null = null;
    let departmentAccountId: string | null = null;

    if (email && password) {
      const normalizedEmail = String(email).toLowerCase().trim();
      const company = await db.deliveryCompany.findFirst({
        where: { contactEmail: normalizedEmail },
      });
      if (company && company.passwordHash) {
        if (company.status === "SUSPENDED") {
          return NextResponse.json(
            { error: "Company account is suspended. Contact support." },
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
      } else {
        const deptAccount = await db.deliveryCompanyDepartmentAccount.findFirst({
          where: { email: normalizedEmail, status: "ACTIVE" },
          include: {
            deliveryCompany: { select: { id: true, name: true, status: true } },
            department: { select: { id: true } },
          },
        });
        if (!deptAccount || deptAccount.deliveryCompany.status === "SUSPENDED") {
          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
        const valid = await bcrypt.compare(String(password), deptAccount.passwordHash);
        if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        const rawKey = `dck_${randomBytes(20).toString("hex")}`;
        const keyPrefix = rawKey.slice(0, 12);
        const keyHash = createHash("sha256").update(rawKey).digest("hex");
        await db.deliveryCompanyApiKey.create({
          data: {
            deliveryCompanyId: deptAccount.deliveryCompanyId,
            name: `dept-session-${deptAccount.id.slice(0, 6)}`,
            keyPrefix,
            keyHash,
            scopes: [
              "orders:read",
              "orders:write",
              "wallet:read",
              "departments:read",
            ],
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        });
        resolvedCompanyId = deptAccount.deliveryCompanyId;
        resolvedCompanyName = deptAccount.deliveryCompany.name;
        resolvedApiKey = rawKey;
        actorRole = deptAccount.role;
        departmentId = deptAccount.departmentId;
        departmentAccountId = deptAccount.id;
        await db.deliveryCompanyDepartmentAccount.update({
          where: { id: deptAccount.id },
          data: { lastLoginAt: new Date() },
        });
      }
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
      if (!row || row.deliveryCompany.status === "SUSPENDED") {
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

    // Do not overwrite department context for signed-in department accounts.
    if (!departmentAccountId) {
      const mainDept = await db.deliveryCompanyAddress.findFirst({
        where: { deliveryCompanyId: resolvedCompanyId, isMainDepartment: true },
        select: { id: true },
      });
      if (mainDept?.id) departmentId = mainDept.id;
    }

    const token = await signCompanyToken({
      companyId: resolvedCompanyId,
      companyName: resolvedCompanyName,
      apiKey: resolvedApiKey,
      actorRole,
      departmentId,
      departmentAccountId,
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
