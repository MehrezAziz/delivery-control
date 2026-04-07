import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;

  const [logs, submissions] = await Promise.all([
    prisma.actionLog.findMany({
      where: {
        targetType: "DRIVER",
        targetId: id,
      },
      include: {
        superUser: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.driverVerification.findMany({
      where: { driverId: id },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        documentType: true,
        submittedAt: true,
      },
      take: 20,
    }),
  ]);

  const submissionEvents = submissions
    .filter((item) => !!item.submittedAt)
    .map((item) => ({
      id: `verification-submission-${item.id}`,
      actionType: "SUBMIT_VERIFICATION",
      actorRole: "DRIVER",
      actorName: "Driver",
      oldValue: null,
      newValue: "PENDING_REVIEW",
      reason: `Submitted ${item.documentType} verification`,
      createdAt: item.submittedAt as Date,
    }));

  const mergedLogs = [
    ...logs.map((log) => ({
      id: log.id,
      actionType: log.actionType,
      actorRole: log.actorRole,
      actorName: log.superUser?.pseudo || log.superUser?.email || "Staff",
      oldValue: log.oldValue,
      newValue: log.newValue,
      reason: log.reason,
      createdAt: log.createdAt,
    })),
    ...submissionEvents,
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 80);

  return NextResponse.json({
    logs: mergedLogs,
  });
}
