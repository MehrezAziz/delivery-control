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
    const email = String((payload as { accountEmail?: string }).accountEmail || "").trim();
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    const urgentManual = !!(payload as { urgentDidNotAutoApprove?: boolean }).urgentDidNotAutoApprove;
    const reason = String((payload as { autoApproveBlockReason?: string }).autoApproveBlockReason || "").trim();
    if (urgentManual) {
      title = "Urgent budget — manual review needed";
      const reasonBit = reason ? ` ${reason.slice(0, 220)}${reason.length > 220 ? "…" : ""}` : "";
      body = email
        ? `Urgent request from ${email} (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins) did not auto-approve under policy.${reasonBit} Approve or reject in Budgets.`
        : `An urgent budget request (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins) needs manual review.${reasonBit}`;
    } else {
      title = "New budget request";
      body = email
        ? `Department account ${email} submitted a budget request (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins). Review it in Budgets.`
        : `A department submitted a budget request (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins). Review it in Budgets.`;
    }
  } else if (type === "BUDGET_REQUEST_UPDATED_MAIN") {
    mappedType = "SUPPORT_HUMAN_REQUESTED";
    title = "Budget request updated";
    const email = String((payload as { accountEmail?: string }).accountEmail || "").trim();
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    const prio = String((payload as { priority?: string }).priority || "").trim();
    body = email
      ? `${email} updated a pending budget request (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins${prio ? `, ${prio}` : ""}). Review in Budgets.`
      : `A pending budget request was updated (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins). Review in Budgets.`;
  } else if (type === "BUDGET_REQUEST_CANCELLED_MAIN") {
    mappedType = "SUPPORT_HUMAN_REQUESTED";
    title = "Budget request cancelled";
    const email = String((payload as { accountEmail?: string }).accountEmail || "").trim();
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    body = email
      ? `${email} cancelled a pending budget request (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins).`
      : `A pending budget request was cancelled (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins).`;
  } else if (type === "BUDGET_RECALL_FROM_COMPANY_DEPT") {
    mappedType = "ORDER_PAYMENT_DEDUCTED";
    title = "Coins recalled from department budget";
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    const label = String((payload as { departmentLabel?: string }).departmentLabel || "").trim();
    body = label
      ? `The main company recalled ${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins from your department budget (${label}). Your available department budget decreased.`
      : `The main company recalled ${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins from your department budget.`;
  } else if (type === "BUDGET_AUTO_URGENT_INFO_MAIN") {
    mappedType = "SUPPORT_HUMAN_REQUESTED";
    title = "Urgent budget auto-approved";
    const email = String((payload as { accountEmail?: string }).accountEmail || "").trim();
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    body = email
      ? `An urgent budget request from ${email} was auto-approved (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins) under this account’s policy.`
      : `An urgent budget request was auto-approved (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins) under policy.`;
  } else if (type === "SCHEDULED_BUDGET_INSUFFICIENT_REMINDER_MAIN") {
    mappedType = "SUPPORT_HUMAN_REQUESTED";
    title = "Scheduled budget: top up needed";
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    const email = String((payload as { accountEmail?: string }).accountEmail || "").trim();
    const when = String((payload as { nextRunAt?: string }).nextRunAt || "").trim();
    body = email
      ? `Within ~24h, a scheduled transfer of ${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins is due for ${email}, but the company wallet does not have enough available balance. Add coins before ${when || "the run"}.`
      : `A scheduled budget transfer is due within ~24h (${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins), but the company wallet balance is insufficient.`;
  } else if (type === "SCHEDULED_BUDGET_RUN_SKIPPED_MAIN") {
    mappedType = "DISPUTE_REQUIRES_DECISION";
    title = "Scheduled budget skipped";
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    body = `A scheduled budget transfer of ${Number.isFinite(amt) ? amt.toFixed(2) : "?"} coins was skipped due to insufficient company balance. The schedule was advanced to the next period — top up for the next run.`;
  } else if (type === "BUDGET_REQUEST_DECIDED") {
    mappedType = payload?.decision === "APPROVE" ? "SUPPORT_TICKET_REPLY" : "DISPUTE_REQUIRES_DECISION";
    title = "Budget request decision";
    body =
      payload?.decision === "APPROVE"
        ? "Your budget request has been approved."
        : "Your budget request has been rejected.";
  } else if (type === "COMPANY_FINANCE_ADJUSTED") {
    const amt = Number((payload as { amountCoins?: unknown }).amountCoins ?? 0);
    const after = Number((payload as { balanceAfter?: unknown }).balanceAfter ?? 0);
    const r = String((payload as { reason?: string }).reason || "").trim();
    const signed = Number.isFinite(amt) ? amt.toFixed(2) : "?";
    const afterStr = Number.isFinite(after) ? after.toFixed(2) : "?";
    mappedType = amt >= 0 ? "WALLET_TOPUP_SUCCESS" : "ORDER_PAYMENT_DEDUCTED";
    title = amt >= 0 ? "Coins added to company wallet" : "Coins withdrawn from company wallet";
    body =
      amt >= 0
        ? `Staff added ${signed} coins.${r ? ` Note: ${r.slice(0, 200)}${r.length > 200 ? "…" : ""}` : ""} Balance: ${afterStr}.`
        : `Staff withdrew ${Math.abs(Number(amt)).toFixed(2)} coins.${r ? ` Note: ${r.slice(0, 200)}${r.length > 200 ? "…" : ""}` : ""} Balance: ${afterStr}.`;
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
  const scheduleId = (payload as { scheduleId?: string }).scheduleId;
  const inferredGroupKey =
    (payload as { groupKey?: string }).groupKey ??
    (requestId && type.includes("BUDGET") && !type.includes("SCHEDULED") ? `budget:${requestId}` : undefined) ??
    (scheduleId && type.includes("SCHEDULED_BUDGET") ? `scheduled-budget:${scheduleId}` : undefined) ??
    (requestId && type.includes("REFUND") ? `refund:${requestId}` : undefined);

  const relatedEntityType = type.includes("REFUND")
    ? "RefundRequest"
    : type.includes("SCHEDULED_BUDGET")
      ? "ScheduledBudgetTransfer"
      : type === "BUDGET_RECALL_FROM_COMPANY_DEPT" || type === "COMPANY_FINANCE_ADJUSTED"
        ? "CompanyWallet"
        : "BudgetRequest";
  const relatedEntityId =
    type === "COMPANY_FINANCE_ADJUSTED"
      ? String((payload as { companyId?: string }).companyId || targetUserId)
      : scheduleId ?? requestId ?? null;
  const jsonBody = JSON.stringify({
    type: mappedType,
    title,
    body,
    relatedEntityType,
    relatedEntityId,
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
        relatedEntityId,
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
