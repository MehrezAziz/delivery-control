import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;

  const verification = await prisma.driverVerification.findUnique({
    where: { driverId: id },
    include: { documents: true },
  });

  if (!verification) {
    return NextResponse.json({ documents: [] });
  }

  return NextResponse.json({ documents: verification.documents });
}
