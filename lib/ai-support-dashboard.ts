import type { PrismaClient } from "@prisma/client";

export async function loadAiSupportDashboard(prisma: PrismaClient, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [feedbackGroups, toolGroups, escalations, botMessages, totalToolCalls, toolSuccess, recentLogs, runtimeRow] =
    await Promise.all([
      prisma.aiSupportFeedback.groupBy({
        by: ["helpful"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      }),
      prisma.aiSupportToolLog.groupBy({
        by: ["toolName"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      }),
      prisma.supportTicket.count({
        where: { humanEscalationNotifiedAt: { gte: since } },
      }),
      prisma.supportMessage.count({
        where: { senderType: "BOT", timestamp: { gte: since } },
      }),
      prisma.aiSupportToolLog.count({ where: { createdAt: { gte: since } } }),
      prisma.aiSupportToolLog.groupBy({
        by: ["success"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      }),
      prisma.aiSupportToolLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.systemConfig.findUnique({ where: { key: "ai_support_enabled" } }),
    ]);

  let helpfulYes = 0;
  let helpfulNo = 0;
  for (const row of feedbackGroups) {
    if (row.helpful) helpfulYes = row._count.id;
    else helpfulNo = row._count.id;
  }

  let toolOk = 0;
  let toolFail = 0;
  for (const row of toolSuccess) {
    if (row.success) toolOk = row._count.id;
    else toolFail = row._count.id;
  }

  const toolByName = toolGroups
    .map((g) => ({ toolName: g.toolName, count: g._count.id }))
    .sort((a, b) => b.count - a.count);

  const runtimeDisabledByAdmin = (runtimeRow?.value ?? "").toLowerCase() === "false";

  return {
    periodDays: days,
    since: since.toISOString(),
    feedback: {
      helpful: helpfulYes,
      notHelpful: helpfulNo,
      total: helpfulYes + helpfulNo,
    },
    escalationsWithHumanRequest: escalations,
    botMessages,
    toolCalls: {
      total: totalToolCalls,
      success: toolOk,
      failure: toolFail,
      byTool: toolByName,
    },
    recentLogs,
    runtimeDisabledByAdmin,
  };
}
