import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hasCSRole } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  const { id } = await params;

  if (auth.role === "CUSTOMER_SERVICE" && !hasCSRole(auth, "VERIFY_ACCOUNTS")) {
    return NextResponse.json(
      { error: "You don't have VERIFY_ACCOUNTS permission" },
      { status: 403 },
    );
  }

  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      driverVerifications: {
        orderBy: { submittedAt: "desc" },
        include: {
          documents: {
            orderBy: { id: "desc" },
          },
        },
      },
    },
  });

  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const history = driver.driverVerifications.map((verification) => ({
    id: verification.id,
    driverId: verification.driverId,
    documentType: verification.documentType,
    submittedAt: verification.submittedAt,
    verifiedAt: verification.verifiedAt,
    documents: verification.documents.map((doc) => ({
      id: doc.id,
      verificationStatus: doc.verificationStatus,
      selfieImage: doc.selfieImage,
      docImageTop: doc.docImageTop,
      docImageBottom: doc.docImageBottom,
      selfieVerified: doc.selfieVerified,
      mlAnalysis: doc.mlAnalysis,
      firstName: doc.firstName,
      lastName: doc.lastName,
      idNumber: doc.idNumber,
      dateOfBirth: doc.dateOfBirth,
      translationLocale: doc.translationLocale,
      translationData: doc.translationData,
    })),
  }));

  return NextResponse.json({ history });
}
