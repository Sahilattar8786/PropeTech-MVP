import { PLANS, TRIAL_DAYS, TRIAL_PLAN, type Entitlements, type PlanId } from "@/lib/config/plans";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { Collection, Property, Subscription, type ISubscription } from "@/server/models";
import { audit } from "@/server/services/audit/audit.service";
import { getBillingProvider } from "./billing.provider";

export interface SubscriptionDTO {
  plan: PlanId;
  status: ISubscription["status"];
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  provider: ISubscription["provider"];
}

export async function createTrialSubscription(tenantId: string) {
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  return Subscription.create({ tenantId, plan: TRIAL_PLAN, status: "trialing", trialEndsAt, provider: env().BILLING_PROVIDER });
}

/** Loads the subscription, lazily downgrading expired trials to Free. */
export async function getSubscription(tenantId: string): Promise<SubscriptionDTO> {
  await connectDB();
  let sub = await Subscription.findOne({ tenantId });
  if (!sub) sub = await Subscription.create({ tenantId, plan: "free", status: "active", provider: env().BILLING_PROVIDER });
  if (sub.status === "trialing" && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
    sub.plan = "free";
    sub.status = "active";
    sub.trialEndsAt = undefined;
    await sub.save();
  }
  return {
    plan: sub.plan,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt?.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
    provider: sub.provider,
  };
}

/** Whole days left in a trial, or null when not trialing. */
export function trialDaysLeft(sub: Pick<SubscriptionDTO, "status" | "trialEndsAt">): number | null {
  if (sub.status !== "trialing" || !sub.trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

export async function getEntitlements(tenantId: string): Promise<Entitlements> {
  const sub = await getSubscription(tenantId);
  return PLANS[sub.plan].entitlements;
}

export async function assertCanCreateProperty(tenantId: string) {
  const { maxProperties } = await getEntitlements(tenantId);
  const count = await Property.countDocuments({ tenantId });
  if (count >= maxProperties) {
    throw new AppError("LIMIT_EXCEEDED", `Your plan allows ${maxProperties} properties. Upgrade to add more.`);
  }
}

export async function assertCanCreateCollection(tenantId: string) {
  const { maxCollections } = await getEntitlements(tenantId);
  const count = await Collection.countDocuments({ tenantId });
  if (count >= maxCollections) {
    throw new AppError("LIMIT_EXCEEDED", `Your plan allows ${maxCollections} collections. Upgrade to Pro for more.`);
  }
}

export async function getUsage(tenantId: string) {
  await connectDB();
  const [properties, collections] = await Promise.all([Property.countDocuments({ tenantId }), Collection.countDocuments({ tenantId })]);
  return { properties, collections };
}

export async function changePlan(ctx: TenantContext, plan: PlanId): Promise<SubscriptionDTO> {
  assertCan(ctx, "billing:manage");
  await connectDB();
  const provider = getBillingProvider(env().BILLING_PROVIDER);
  if (plan === "free") {
    await provider.cancel({ tenantId: ctx.tenantId });
    await Subscription.updateOne({ tenantId: ctx.tenantId }, { $set: { plan, status: "active" }, $unset: { trialEndsAt: 1, currentPeriodEnd: 1 } }, { upsert: true });
  } else {
    const result = await provider.startCheckout({ tenantId: ctx.tenantId, plan, email: ctx.email });
    if (result.type === "redirect") throw new AppError("INTEGRATION", "Redirect-based checkout is not wired up yet");
    await Subscription.updateOne(
      { tenantId: ctx.tenantId },
      { $set: { plan, status: "active", currentPeriodEnd: result.periodEnd, provider: provider.name }, $unset: { trialEndsAt: 1 } },
      { upsert: true },
    );
  }
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "subscription.plan_changed", { type: "subscription" }, { plan });
  return getSubscription(ctx.tenantId);
}
