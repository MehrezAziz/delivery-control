import { prisma } from "@/lib/prisma";
import { loadAiSupportDashboard } from "@/lib/ai-support-dashboard";
import AiSupportClient from "./ai-support-client";

export const dynamic = "force-dynamic";

export default async function AiSupportPage() {
  const data = await loadAiSupportDashboard(prisma, 30);

  const serialized = {
    periodDays: data.periodDays,
    since: data.since,
    feedback: data.feedback,
    escalationsWithHumanRequest: data.escalationsWithHumanRequest,
    botMessages: data.botMessages,
    toolCalls: data.toolCalls,
    recentLogs: data.recentLogs.map((row) => ({
      id: row.id,
      toolName: row.toolName,
      ticketId: row.ticketId,
      durationMs: row.durationMs,
      success: row.success,
      createdAt: row.createdAt.toISOString(),
    })),
    runtimeDisabledByAdmin: data.runtimeDisabledByAdmin,
  };

  return <AiSupportClient data={serialized} />;
}
