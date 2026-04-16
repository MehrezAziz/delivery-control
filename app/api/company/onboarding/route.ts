import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";

export async function GET() {
  try {
    const db: any = prisma;
    const auth = await requireCompanyAuth();
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
    const body = await req.json();
    if (body.password) {
      await db.deliveryCompany.update({
        where: { id: auth.companyId },
        data: { passwordHash: await bcrypt.hash(String(body.password), 10) },
      });
    }
    if (body.bankAccount) {
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
        defaultRefundDestinationType: body.defaultRefundDestinationType || undefined,
        onboardingCompleted: true,
      },
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
