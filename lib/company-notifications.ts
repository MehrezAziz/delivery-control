import { logCompanyAudit } from "@/lib/company-security";
import { companyBackendFetch } from "@/lib/company-api";

export async function emitDepartmentNotification(
  companyId: string,
  departmentId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await logCompanyAudit(companyId, "DEPARTMENT_NOTIFICATION_EMITTED", "SYSTEM", null, {
    departmentId,
    type,
    payload,
  });

  // Real-time delivery: dispatch through backend NotificationsService → websocket/in-app.
  // We map internal budget events to existing backend NotificationType values.
  let mappedType = "SUPPORT_HUMAN_REQUESTED";
  let title = "Delivery company update";
  let body = "A new update is available.";

  if (type === "BUDGET_REQUEST_CREATED") {
    mappedType = "SUPPORT_HUMAN_REQUESTED";
    title = "Budget request created";
    body = "Your budget request has been created.";
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

  try {
    await companyBackendFetch("/notifications/department", {
      method: "POST",
      body: JSON.stringify({
        type: mappedType,
        title,
        body,
        relatedEntityType: type.includes("REFUND") ? "RefundRequest" : "BudgetRequest",
        relatedEntityId: requestId ?? null,
        groupKey: inferredGroupKey,
      }),
    });
  } catch (e) {
    // Intentionally swallow: audit log already recorded.
  }
}
