import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasCSRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();

    if (auth.role === "CUSTOMER_SERVICE") {
      if (!hasCSRole(auth, "VIEW_FINANCIAL_REPORTS") && !hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    const wallets = await prisma.digitalWallet.findMany({
      include: {
        customer: {
          include: {
            user: { select: { id: true, firstName: true, secondName: true, phone: true } },
            myReferralCode: { select: { code: true } },
          },
        },
        country: { select: { name: true, currencyCode: true } },
      },
      orderBy: { balance: "asc" },
    });

    const result = wallets.map((w) => ({
      id: w.id,
      customerId: w.customerId,
      balance: Number(w.balance),
      lockedForTransfers: Number(w.lockedForTransfers),
      currency: w.currency,
      discount: Number(w.discount),
      customerName:
        `${w.customer.user.firstName || ""} ${w.customer.user.secondName || ""}`.trim() || "Unknown",
      phone: w.customer.user.phone,
      customerStatus: w.customer.customerStatus,
      referralCode: w.customer.myReferralCode?.code ?? null,
      countryName: w.country.name,
      updatedAt: w.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
