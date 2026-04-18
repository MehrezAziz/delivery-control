import { randomUUID } from "crypto";
import { logCompanyAudit } from "@/lib/company-security";
import { companyBackendFetch } from "@/lib/company-api";
import { prisma } from "@/lib/prisma";

/** Persist inbox row when backend API is unreachable or returns an error (shared DB with delivery-backend). */
async function persistCompanyInAppNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  groupKey?: string | null;
}) {
  await prisma.notification.create({
    data: {
      id: randomUUID(),
      userId: opts.userId,
      userType: "USER",
      title: opts.title,
      body: opts.body,
      type: opts.type as any,
      priority: "MEDIUM",
      channels: ["IN_APP", "WEB_SOCKET"],
      relatedEntityType: opts.relatedEntityType ?? null,
      relatedEntityId: opts.relatedEntityId ?? null,
      groupKey: opts.groupKey ?? null,
      deliveryStatus: "SENT",
    },
  });
}

/** @param targetUserId Department address id, department account id, or company id — stored as Notification.userId for the company portal inbox. */
export async function emitDepartmentNotification(
  companyId: string,
  targetUserId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await logCompanyAudit(companyId, "DEPARTMENT_NOTIFICATION_EMITTED", "SYSTEM", null, {
    targetUserId,
    type,
    payload,
  });

  // Real-time delivery: dispatch through backend NotificationsService → websocket/in-app.
  // We map internal budget events to existing backend NotificationType values.
  let mappedType = "SUPPORT_HUMAN_REQUESTED";
  let title = "Delivery company update";
  let body = "A new update is available.";

  if (type === "BUDGET_REQUEST_PENDING_MAIN") {
    mappedType = "SUPPORT_HUMAN_REQUESTED";
    title = "New budget request";
    const email = String((payload as { accountEmail?: string }).accountEmail || "").trim();
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    body = email
      ? `Department account ${email} submitted a budget request (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins). Review it in Budgets.`
      : `A department submitted a budget request (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins). Review it in Budgets.`;
  } else if (type === "BUDGET_AUTO_URGENT_INFO_MAIN") {
    mappedType = "SUPPORT_HUMAN_REQUESTED";
    title = "Urgent budget auto-approved";
    const email = String((payload as { accountEmail?: string }).accountEmail || "").trim();
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    body = email
      ? `An urgent budget request from ${email} was auto-approved (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins) under this account’s policy.`
      : `An urgent budget request was auto-approved (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins) under policy.`;
  } else if (type === "BUDGET_REQUEST_DECIDED") {
    mappedType = payload?.decision === "APPROVE" ? "SUPPORT_TICKET_REPLY" : "DISPUTE_REQUIRES_DECISION";
    title = "Budget request decision";
    body =
      payload?.decision === "APPROVE"
        ? "Your budget request has been approved."
        : "Your budget request has been rejected.";
  } else if (type === "REFUND_REQUEST_CREATED") {
    mappedType = "REFUND_PROCESSED";
    title = "Refund request created";
    body = "Your refund request has been submitted.";
  } else if (type === "REFUND_REQUEST_DECIDED") {
    mappedType = payload?.status === "PAID" || payload?.decision === "APPROVE" ? "REFUND_PROCESSED" : "DISPUTE_REQUIRES_DECISION";
    title = "Refund request decision";
    body =
      mappedType === "REFUND_PROCESSED"
        ? "Your refund has been processed."
        : "Your refund request was rejected or failed.";
  }

  // Fire-and-forget style: if notification dispatch fails, do not break business flow.
  const requestId = (payload as { requestId?: string }).requestId;
  const inferredGroupKey =
    (payload as { groupKey?: string }).groupKey ??
    (requestId && type.includes("BUDGET") ? `budget:${requestId}` : undefined) ??
    (requestId && type.includes("REFUND") ? `refund:${requestId}` : undefined);

  const relatedEntityType = type.includes("REFUND") ? "RefundRequest" : "BudgetRequest";
  const jsonBody = JSON.stringify({
    type: mappedType,
    title,
    body,
    relatedEntityType,
    relatedEntityId: requestId ?? null,
    groupKey: inferredGroupKey,
    targetUserId,
  });

  const persistLocal = async () => {
    try {
      await persistCompanyInAppNotification({
        userId: targetUserId,
        type: mappedType,
        title,
        body,
        relatedEntityType,
        relatedEntityId: requestId ?? null,
        groupKey: inferredGroupKey ?? null,
      });
    } catch {
      // last resort failed
    }
  };

  try {
    const res = await companyBackendFetch("/notifications/department", {
      method: "POST",
      body: jsonBody,
    });
    if (!res.ok) {
      await persistLocal();
    }
  } catch {
    await persistLocal();
  }
}
