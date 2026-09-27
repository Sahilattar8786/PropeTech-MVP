import { PLANS, type PlanId } from "@/lib/config/plans";
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@/lib/domain/billing";
import type { AuditRow } from "@/server/services/admin/admin.service";

const LABELS: Record<string, string> = {
  "admin.subscription.updated": "Subscription edited",
  "admin.payment.recorded": "Payment recorded",
  "admin.invoice.refunded": "Invoice refunded",
  "admin.invoice.void": "Invoice voided",
  "admin.workspace.suspended": "Workspace suspended",
  "admin.workspace.reactivated": "Workspace reactivated",
  "admin.domain.configured": "Domain added to hosting",
  "admin.domain.rejected": "Domain request rejected",
  "admin.domain.reopened": "Domain request reopened",
  "admin.domain.disconnected": "Domain disconnected",
  "admin.domain.removal_completed": "Domain removed from hosting",
  "subscription.plan_changed": "Plan changed by broker",
  "whatsapp.number_connected": "WhatsApp number connected",
  "whatsapp.number_disconnected": "WhatsApp number disconnected",
};

/** "property.status_changed" → "Property status changed" for actions without a curated label. */
export function auditLabel(action: string): string {
  if (LABELS[action]) return LABELS[action];
  const text = action.replace(/^admin\./, "").replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const inr = new Intl.NumberFormat("en-IN");
const planName = (plan: unknown) => (typeof plan === "string" && plan in PLANS ? PLANS[plan as PlanId].name : undefined);

/** One-line summary of the metadata worth showing in the log. */
export function auditDetail(row: Pick<AuditRow, "action" | "metadata">): string | undefined {
  const m = row.metadata ?? {};
  const parts: string[] = [];
  if (typeof m.hostname === "string") parts.push(m.hostname);
  if (typeof m.number === "string") parts.push(m.number);
  if (typeof m.amount === "number") parts.push(`₹${inr.format(m.amount)}`);
  if (row.action === "admin.subscription.updated") {
    const before = m.before as { plan?: string; status?: string } | null | undefined;
    const after = m.after as { plan?: string; status?: string } | null | undefined;
    const status = after?.status && after.status in SUBSCRIPTION_STATUS_LABELS ? SUBSCRIPTION_STATUS_LABELS[after.status as SubscriptionStatus] : after?.status;
    if (after) parts.push(`${planName(before?.plan) ?? "—"} → ${planName(after.plan)} (${status})`);
  } else if (m.plan) {
    parts.push(planName(m.plan) ?? String(m.plan));
  }
  if (typeof m.reason === "string") parts.push(`“${m.reason}”`);
  if (typeof m.note === "string") parts.push(`“${m.note}”`);
  return parts.length ? parts.join(" · ") : undefined;
}
