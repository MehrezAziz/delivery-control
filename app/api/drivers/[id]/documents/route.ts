import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;

  const verifications = await prisma.driverVerification.findMany({
    where: { driverId: id },
    include: { documents: true },
    orderBy: { submittedAt: "desc" },
  });

  const latestVerification = verifications[0] ?? null;

  if (!latestVerification) {
    return NextResponse.json({ documents: [] });
  }

  return NextResponse.json({ documents: latestVerification.documents });
}
