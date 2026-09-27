import type { PlanId } from "@/lib/config/plans";
import {
  endOfISTDay,
  istMonthKey,
  istMonthStart,
  monthlyPrice,
  paymentPeriod,
  renewalState,
  startOfISTDay,
  summarizeMrr,
  type InvoiceProvider,
  type InvoiceStatus,
  type MrrSummary,
  type PaymentMethod,
  type RenewalState,
  type SubscriptionStatus,
} from "@/lib/domain/billing";
import type { AdminSubscriptionInput, InvoiceStatusChangeInput, RecordPaymentInput } from "@/lib/validation/admin";
import type { PlatformAdmin } from "@/server/auth/context";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import { Invoice, isObjectId, Subscription, Tenant, type IInvoice, type ISubscription } from "@/server/models";
import { createInvoice } from "@/server/services/subscriptions/invoice.service";
import { expireTrials } from "@/server/services/subscriptions/subscription.service";
import { ADMIN_PAGE_SIZE, auditAdmin, lookupWorkspaces, pageCount, workspaceOf, type WorkspaceRef } from "./shared";

const DAY_MS = 86_400_000;
const RENEWAL_WINDOW_DAYS = 7;

/* ─────────────────────────── Revenue ─────────────────────────── */

export interface RevenueMonth {
  month: string;
  amount: number;
  count: number;
}

export interface RevenueOverview {
  mrr: MrrSummary;
  trialing: number;
  renewalsDue: number;
  collectedThisMonth: number;
  collectedLastMonth: number;
  collectedTrailing12: number;
  series: RevenueMonth[];
  includeTest: boolean;
}

/** MRR is derived from subscriptions; collected revenue from the invoice ledger (paid, net of refunds). */
export async function getRevenueOverview(opts: { includeTest?: boolean } = {}): Promise<RevenueOverview> {
  await connectDB();
  await expireTrials();
  const now = new Date();
  const includeTest = opts.includeTest ?? false;
  const since = istMonthStart(now, -11);

  const [subs, monthly] = await Promise.all([
    Subscription.find({ plan: { $ne: "free" } }).select("plan status priceOverride currentPeriodEnd").lean<ISubscription[]>(),
    Invoice.aggregate<{ _id: string; amount: number; count: number }>([
      { $match: { status: "paid", paidAt: { $gte: since }, ...(includeTest ? {} : { livemode: true }) } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: "Asia/Kolkata" } }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const byMonth = new Map(monthly.map((m) => [m._id, m]));
  const series = Array.from({ length: 12 }, (_, i) => {
    const month = istMonthKey(istMonthStart(now, i - 11));
    return { month, amount: byMonth.get(month)?.amount ?? 0, count: byMonth.get(month)?.count ?? 0 };
  });

  return {
    mrr: summarizeMrr(subs),
    trialing: subs.filter((s) => s.status === "trialing").length,
    renewalsDue: subs.filter((s) => renewalState(s, now, RENEWAL_WINDOW_DAYS)).length,
    collectedThisMonth: series.at(-1)!.amount,
    collectedLastMonth: series.at(-2)!.amount,
    collectedTrailing12: series.reduce((sum, m) => sum + m.amount, 0),
    series,
    includeTest,
  };
}

/* ─────────────────────────── Subscriptions ─────────────────────────── */

export const SUBSCRIPTION_FILTERS = ["paying", "renewals", "past_due", "trialing", "free", "all"] as const;
export type SubscriptionFilter = (typeof SUBSCRIPTION_FILTERS)[number];

export const SUBSCRIPTION_FILTER_LABELS: Record<SubscriptionFilter, string> = {
  paying: "Paid plans",
  renewals: "Renewals due",
  past_due: "Past due",
  trialing: "Trials",
  free: "Free",
  all: "All",
};

function subscriptionQuery(filter: SubscriptionFilter, now: Date): Record<string, unknown> {
  const billed = { plan: { $ne: "free" }, status: { $in: ["active", "past_due"] } };
  switch (filter) {
    case "paying":
      return billed;
    case "renewals":
      return { ...billed, priceOverride: { $ne: 0 }, currentPeriodEnd: { $lte: new Date(now.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS) } };
    case "past_due":
      return { status: "past_due" };
    case "trialing":
      return { status: "trialing" };
    case "free":
      return { plan: "free" };
    case "all":
      return {};
  }
}

const SUBSCRIPTION_SORT: Record<SubscriptionFilter, Record<string, 1 | -1>> = {
  paying: { updatedAt: -1 },
  renewals: { currentPeriodEnd: 1 },
  past_due: { currentPeriodEnd: 1 },
  trialing: { trialEndsAt: 1 },
  free: { updatedAt: -1 },
  all: { updatedAt: -1 },
};

export interface AdminSubscriptionRow {
  tenantId: string;
  workspace: WorkspaceRef;
  plan: PlanId;
  status: SubscriptionStatus;
  monthlyPrice: number;
  priceOverride?: number;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  renewal: RenewalState | null;
  adminNotes?: string;
  updatedAt: string;
}

function toSubscriptionRow(sub: ISubscription, workspace: WorkspaceRef, now: Date): AdminSubscriptionRow {
  return {
    tenantId: String(sub.tenantId),
    workspace,
    plan: sub.plan,
    status: sub.status,
    monthlyPrice: monthlyPrice(sub),
    priceOverride: sub.priceOverride ?? undefined,
    trialEndsAt: sub.trialEndsAt?.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
    renewal: renewalState(sub, now, RENEWAL_WINDOW_DAYS),
    adminNotes: sub.adminNotes ?? undefined,
    updatedAt: sub.updatedAt.toISOString(),
  };
}

export async function listSubscriptions(opts: { filter?: SubscriptionFilter; page?: number } = {}) {
  await connectDB();
  await expireTrials();
  const now = new Date();
  const filter = opts.filter ?? "paying";
  const page = Math.max(1, opts.page ?? 1);
  const query = subscriptionQuery(filter, now);

  const [docs, total, counts] = await Promise.all([
    Subscription.find(query)
      .sort(SUBSCRIPTION_SORT[filter])
      .skip((page - 1) * ADMIN_PAGE_SIZE)
      .limit(ADMIN_PAGE_SIZE)
      .lean<ISubscription[]>(),
    Subscription.countDocuments(query),
    Promise.all(SUBSCRIPTION_FILTERS.map(async (f) => [f, await Subscription.countDocuments(subscriptionQuery(f, now))] as const)),
  ]);
  const workspaces = await lookupWorkspaces(docs.map((d) => d.tenantId));
  return {
    items: docs.map((d) => toSubscriptionRow(d, workspaceOf(workspaces, d.tenantId), now)),
    counts: Object.fromEntries(counts) as Record<SubscriptionFilter, number>,
    filter,
    page,
    pages: pageCount(total),
  };
}

export async function getTenantSubscriptionRow(tenantId: string): Promise<AdminSubscriptionRow | null> {
  await connectDB();
  await expireTrials();
  const sub = await Subscription.findOne({ tenantId }).lean<ISubscription>();
  if (!sub) return null;
  const workspaces = await lookupWorkspaces([tenantId]);
  return toSubscriptionRow(sub, workspaceOf(workspaces, tenantId), new Date());
}

async function assertTenant(tenantId: string) {
  if (!isObjectId(tenantId) || !(await Tenant.exists({ _id: tenantId }))) throw notFound("Workspace");
}

const snapshot = (sub: ISubscription | null) =>
  sub && {
    plan: sub.plan,
    status: sub.status,
    priceOverride: sub.priceOverride,
    trialEndsAt: sub.trialEndsAt?.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
  };

/** Direct edit by a platform admin (e.g. a negotiated deal or a support extension). Bypasses the billing provider. */
export async function updateSubscription(admin: PlatformAdmin, tenantId: string, input: AdminSubscriptionInput) {
  await connectDB();
  await assertTenant(tenantId);
  const before = await Subscription.findOne({ tenantId }).lean<ISubscription>();

  const $set: Record<string, unknown> = { plan: input.plan };
  const $unset: Record<string, 1> = {};
  const unset = (...keys: string[]) => keys.forEach((k) => ($unset[k] = 1));

  if (input.plan === "free") {
    $set.status = "active";
    unset("trialEndsAt", "currentPeriodEnd", "priceOverride");
  } else {
    $set.status = input.status;
    if (input.status === "trialing") {
      $set.trialEndsAt = endOfISTDay(input.trialEndsAt);
      unset("currentPeriodEnd");
    } else {
      unset("trialEndsAt");
      // Like recorded payments, a period runs up to the start of its renewal day.
      if (input.currentPeriodEnd) $set.currentPeriodEnd = startOfISTDay(input.currentPeriodEnd);
      else unset("currentPeriodEnd");
    }
    if (input.priceOverride === "") unset("priceOverride");
    else $set.priceOverride = Number(input.priceOverride);
  }
  if (input.adminNotes) $set.adminNotes = input.adminNotes;
  else unset("adminNotes");

  const after = await Subscription.findOneAndUpdate({ tenantId }, { $set, ...(Object.keys($unset).length ? { $unset } : {}) }, { upsert: true, returnDocument: "after" }).lean<ISubscription>();
  await auditAdmin(admin, tenantId, "subscription.updated", { type: "subscription" }, { before: snapshot(before), after: snapshot(after) });
}

/**
 * Records money received outside a payment gateway (UPI, bank transfer…) and activates the plan
 * for the period it covers. This is how upgrades happen while online payments are disabled.
 */
export async function recordPayment(admin: PlatformAdmin, tenantId: string, input: RecordPaymentInput) {
  await connectDB();
  await assertTenant(tenantId);
  const sub = await Subscription.findOne({ tenantId }).lean<ISubscription>();
  const paidAt = startOfISTDay(input.paidAt);
  const months = Number(input.months);
  const period = paymentPeriod(sub, { plan: input.plan, months, paidAt });

  const invoice = await createInvoice({
    tenantId,
    plan: input.plan,
    amount: Number(input.amount),
    status: "paid",
    provider: "manual",
    method: input.method,
    reference: input.reference || undefined,
    notes: input.notes || undefined,
    paidAt,
    periodStart: period.start,
    periodEnd: period.end,
    recordedBy: admin.userId,
  });

  // A negotiated price is kept on renewal of the same plan, and dropped when the plan changes.
  const planChanged = sub?.plan !== input.plan;
  await Subscription.updateOne(
    { tenantId },
    {
      $set: { plan: input.plan, status: "active", currentPeriodEnd: period.end },
      $unset: { trialEndsAt: 1, ...(planChanged ? { priceOverride: 1 } : {}) },
    },
    { upsert: true },
  );
  await auditAdmin(admin, tenantId, "payment.recorded", { type: "invoice", id: String(invoice._id) }, {
    number: invoice.number,
    plan: input.plan,
    amount: invoice.amount,
    months,
    method: input.method,
    periodEnd: period.end.toISOString(),
  });
  return { number: invoice.number, periodEnd: period.end.toISOString() };
}

/* ─────────────────────────── Invoices ─────────────────────────── */

export interface AdminInvoiceRow {
  id: string;
  number: string;
  tenantId: string;
  workspace: WorkspaceRef;
  plan: PlanId;
  amount: number;
  status: InvoiceStatus;
  provider: InvoiceProvider;
  livemode: boolean;
  method?: PaymentMethod;
  reference?: string;
  periodStart?: string;
  periodEnd?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

export const INVOICE_FILTERS = ["all", "paid", "refunded", "void"] as const;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];

export async function listInvoices(opts: { status?: InvoiceFilter; includeTest?: boolean; tenantId?: string; page?: number; pageSize?: number } = {}) {
  await connectDB();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? ADMIN_PAGE_SIZE;
  const query: Record<string, unknown> = {};
  if (opts.status && opts.status !== "all") query.status = opts.status;
  if (!opts.includeTest) query.livemode = true;
  if (opts.tenantId) query.tenantId = opts.tenantId;

  const [docs, total] = await Promise.all([
    // Newest payment first — backdated entries (recorded late) sit where they belong, not at the top.
    Invoice.find(query).sort({ paidAt: -1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean<IInvoice[]>(),
    Invoice.countDocuments(query),
  ]);
  const workspaces = await lookupWorkspaces(docs.map((d) => d.tenantId));
  const items: AdminInvoiceRow[] = docs.map((d) => ({
    id: String(d._id),
    number: d.number,
    tenantId: String(d.tenantId),
    workspace: workspaceOf(workspaces, d.tenantId),
    plan: d.plan,
    amount: d.amount,
    status: d.status,
    provider: d.provider,
    livemode: d.livemode,
    method: d.method ?? undefined,
    reference: d.reference ?? undefined,
    periodStart: d.periodStart?.toISOString(),
    periodEnd: d.periodEnd?.toISOString(),
    paidAt: d.paidAt?.toISOString(),
    notes: d.notes ?? undefined,
    createdAt: d.createdAt.toISOString(),
  }));
  return { items, page, pages: Math.max(1, Math.ceil(total / pageSize)), total };
}

const ALLOWED_INVOICE_TRANSITIONS: Record<InvoiceStatusChangeInput["status"], InvoiceStatus[]> = {
  refunded: ["paid"],
  void: ["pending", "paid"],
};

/** Refund (money returned) or void (recorded by mistake). Neither changes the subscription — edit it separately. */
export async function changeInvoiceStatus(admin: PlatformAdmin, invoiceId: string, input: InvoiceStatusChangeInput) {
  if (!isObjectId(invoiceId)) throw notFound("Invoice");
  await connectDB();
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound("Invoice");
  if (!ALLOWED_INVOICE_TRANSITIONS[input.status].includes(invoice.status)) {
    throw new AppError("CONFLICT", `A ${invoice.status} invoice can't be marked ${input.status}`);
  }
  const from = invoice.status;
  invoice.status = input.status;
  if (input.status === "refunded") invoice.refundedAt = new Date();
  if (input.note) invoice.notes = [invoice.notes, input.note].filter(Boolean).join("\n").slice(0, 1000);
  await invoice.save();
  await auditAdmin(admin, String(invoice.tenantId), `invoice.${input.status}`, { type: "invoice", id: invoiceId }, {
    number: invoice.number,
    amount: invoice.amount,
    from,
    note: input.note || undefined,
  });
}
