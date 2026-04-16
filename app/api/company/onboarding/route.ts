import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import { ensureMainDepartmentActor } from "@/lib/company-security";

export async function GET() {
  try {
    const db: any = prisma;
    const auth = await requireCompanyAuth();
    ensureMainDepartmentActor(auth);
    const company = await db.deliveryCompany.findUnique({
      where: { id: auth.companyId },
      include: { bankAccounts: { orderBy: { createdAt: "desc" } }, addresses: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    return NextResponse.json(company);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db: any = prisma;
    const auth = await requireCompanyAuth();
    ensureMainDepartmentActor(auth);
    const body = await req.json();
    const company = await db.deliveryCompany.findUnique({ where: { id: auth.companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    if (body.password) {
      if (!body.oldPassword) {
        return NextResponse.json({ error: "Old password is required to change password" }, { status: 400 });
      }
      if (!company.passwordHash) {
        return NextResponse.json({ error: "Password is not initialized yet" }, { status: 400 });
      }
      const validOld = await bcrypt.compare(String(body.oldPassword), String(company.passwordHash));
      if (!validOld) {
        return NextResponse.json({ error: "Old password is incorrect" }, { status: 403 });
      }
      await db.deliveryCompany.update({
        where: { id: auth.companyId },
        data: { passwordHash: await bcrypt.hash(String(body.password), 10) },
      });
    }
    if (body.bankAccount) {
      if (body.bankAccount.id) {
        await db.deliveryCompanyBankAccount.updateMany({
          where: { id: String(body.bankAccount.id), deliveryCompanyId: auth.companyId },
          data: {
            accountHolderName: body.bankAccount.accountHolderName,
            iban: body.bankAccount.iban || null,
            rib: body.bankAccount.rib || null,
            bankName: body.bankAccount.bankName || null,
            swiftBic: body.bankAccount.swiftBic || null,
            currency: body.bankAccount.currency || null,
          },
        });
      } else {
        await db.deliveryCompanyBankAccount.create({
          data: {
            deliveryCompanyId: auth.companyId,
            accountHolderName: body.bankAccount.accountHolderName,
            iban: body.bankAccount.iban || null,
            rib: body.bankAccount.rib || null,
            bankName: body.bankAccount.bankName || null,
            swiftBic: body.bankAccount.swiftBic || null,
            currency: body.bankAccount.currency || null,
          },
        });
      }
    }
    if (body.departmentLabel) {
      await db.deliveryCompanyAddress.create({
        data: {
          deliveryCompanyId: auth.companyId,
          label: body.departmentLabel,
          city: body.departmentCity || null,
          country: body.departmentCountry || null,
          isDefault: true,
        },
      });
    }
    await db.deliveryCompany.update({
      where: { id: auth.companyId },
      data: {
        onboardingCompleted: true,
      },
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
