import { PLANS, type PlanId } from "@/lib/config/plans";

/* Billing vocabulary shared by the admin console, services and models. Pure — safe on client and server. */

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

export const INVOICE_STATUSES = ["pending", "paid", "failed", "refunded", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  void: "Void",
};

export const INVOICE_PROVIDERS = ["mock", "razorpay", "manual"] as const;
export type InvoiceProvider = (typeof INVOICE_PROVIDERS)[number];

export const PAYMENT_METHODS = ["upi", "bank_transfer", "card", "cash", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

/**
 * Ops workflow for a custom domain, separate from its DNS verification status:
 * requested → (ops adds it to hosting) → configured → (broker removes it) → removal_requested → deleted.
 */
export const DOMAIN_SETUP_STATUSES = ["requested", "configured", "rejected", "removal_requested"] as const;
export type DomainSetupStatus = (typeof DOMAIN_SETUP_STATUSES)[number];

export const DOMAIN_SETUP_LABELS: Record<DomainSetupStatus, string> = {
  requested: "Needs setup",
  configured: "On hosting",
  rejected: "Rejected",
  removal_requested: "Needs removal",
};

const DAY_MS = 86_400_000;
/** India has no DST, so IST is a fixed UTC+05:30. */
const IST_OFFSET_MS = 330 * 60_000;

type PricedSubscription = { plan: PlanId; priceOverride?: number | null };
type BilledSubscription = PricedSubscription & { status: SubscriptionStatus; currentPeriodEnd?: Date | string | null };

/** Monthly price in ₹: the negotiated override when set (0 = complimentary), else the plan's list price. */
export function monthlyPrice(sub: PricedSubscription): number {
  if (sub.plan === "free") return 0;
  return sub.priceOverride ?? PLANS[sub.plan].priceMonthly;
}

/** Paid plan, billed (active or in its past-due grace period) and not complimentary. Trials don't count. */
export function contributesToMrr(sub: BilledSubscription): boolean {
  return (sub.status === "active" || sub.status === "past_due") && monthlyPrice(sub) > 0;
}

export interface MrrSummary {
  mrr: number;
  arr: number;
  paying: number;
  /** Average revenue per paying workspace. */
  arpa: number;
  byPlan: Record<PlanId, { count: number; mrr: number }>;
}

export function summarizeMrr(subs: BilledSubscription[]): MrrSummary {
  const byPlan: MrrSummary["byPlan"] = { free: { count: 0, mrr: 0 }, pro: { count: 0, mrr: 0 }, business: { count: 0, mrr: 0 } };
  let mrr = 0;
  let paying = 0;
  for (const sub of subs) {
    if (!contributesToMrr(sub)) continue;
    const price = monthlyPrice(sub);
    mrr += price;
    paying += 1;
    byPlan[sub.plan].count += 1;
    byPlan[sub.plan].mrr += price;
  }
  return { mrr, arr: mrr * 12, paying, arpa: paying ? Math.round(mrr / paying) : 0, byPlan };
}

export type RenewalState = "overdue" | "due_soon";

/** Payments are collected manually for now, so paid periods that have ended (or are about to) need follow-up. */
export function renewalState(sub: BilledSubscription, now = new Date(), windowDays = 7): RenewalState | null {
  if (!contributesToMrr(sub) || !sub.currentPeriodEnd) return null;
  const end = new Date(sub.currentPeriodEnd).getTime();
  if (end < now.getTime()) return "overdue";
  if (end - now.getTime() <= windowDays * DAY_MS) return "due_soon";
  return null;
}

/**
 * Adds calendar months in IST (independent of the server's timezone), clamping to the month's
 * last day: 31 Jan + 1 month → 28/29 Feb, not 3 Mar.
 */
export function addMonths(date: Date, months: number): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDate();
  ist.setUTCDate(1);
  ist.setUTCMonth(ist.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 0)).getUTCDate();
  ist.setUTCDate(Math.min(day, lastDay));
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

/**
 * Service period a new payment covers. A renewal of the same plan paid before the current period
 * ends extends it seamlessly; anything else starts on the payment date.
 */
export function paymentPeriod(
  sub: { plan: PlanId; status: SubscriptionStatus; currentPeriodEnd?: Date | null } | null,
  input: { plan: PlanId; months: number; paidAt: Date },
): { start: Date; end: Date } {
  const current = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const renews = sub && sub.plan === input.plan && sub.status !== "trialing" && current && current > input.paidAt;
  const start = renews ? current : input.paidAt;
  return { start, end: addMonths(start, input.months) };
}

/** Indian financial year label (April–March), e.g. 2026-27 — invoice numbers restart each year. */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

export function invoiceNumber(opts: { livemode: boolean; fy: string; seq: number }): string {
  return `${opts.livemode ? "PF" : "TEST"}/${opts.fy}/${String(opts.seq).padStart(4, "0")}`;
}

/* Billing dates are business days in India: a date picked in the admin console means that day in IST. */

/** Date → "yyyy-mm-dd" (IST) for <input type="date">. */
export function toISTDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "yyyy-mm-dd" → the last moment of that day in IST, so a period ending "27 Oct" covers all of 27 Oct. */
export function endOfISTDay(value: string): Date {
  return new Date(`${value}T23:59:59.999+05:30`);
}

/** "yyyy-mm-dd" → the start of that day in IST. */
export function startOfISTDay(value: string): Date {
  return new Date(`${value}T00:00:00+05:30`);
}

/** Start of the IST calendar month `offset` months from the one containing `now` (0 = this month). */
export function istMonthStart(now: Date, offset = 0): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + offset, 1) - IST_OFFSET_MS);
}

/** "yyyy-mm" key of the IST month containing `date`. */
export function istMonthKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}
