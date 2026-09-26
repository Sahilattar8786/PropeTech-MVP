import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PlanPicker } from "@/features/settings/plan-picker";
import { PLANS } from "@/lib/config/plans";
import { formatDate } from "@/lib/format";
import { can } from "@/server/auth/rbac";
import { requireTenantContext } from "@/server/auth/session";
import { testBillingAllowed } from "@/server/services/subscriptions/billing.provider";
import { getSubscription, getUsage } from "@/server/services/subscriptions/subscription.service";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = { title: "Billing" };

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used} / {limit.toLocaleString("en-IN")}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={used} aria-valuemax={limit} aria-label={label}>
        <div className={pct >= 90 ? "h-full bg-red-500" : "h-full bg-brand"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const ctx = await requireTenantContext();
  const [subscription, usage] = await Promise.all([getSubscription(ctx.tenantId), getUsage(ctx.tenantId)]);
  const plan = PLANS[subscription.plan];
  const trialing = subscription.status === "trialing";
  const selfServeUpgrades = subscription.provider !== "mock" || testBillingAllowed();
  return (
    <div className="max-w-5xl space-y-6">
      <section className="grid gap-6 rounded-2xl border bg-card p-5 shadow-soft sm:grid-cols-2 sm:p-6">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-1 text-2xl font-semibold">{plan.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {trialing && subscription.trialEndsAt
              ? `Free trial until ${formatDate(subscription.trialEndsAt)} — then Free unless you choose a plan.`
              : subscription.currentPeriodEnd
                ? `Renews ${formatDate(subscription.currentPeriodEnd)}`
                : "No payment required"}
          </p>
        </div>
        <div className="space-y-4">
          <Meter label="Properties" used={usage.properties} limit={plan.entitlements.maxProperties} />
          <Meter label="Collections" used={usage.collections} limit={plan.entitlements.maxCollections} />
        </div>
      </section>
      {subscription.provider === "mock" && (
        <p className="flex items-center gap-2 rounded-xl border bg-surface px-4 py-3 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" />
          {selfServeUpgrades ? (
            "Payments are in test mode — plan changes apply instantly without charging."
          ) : (
            <span>
              Online payments are coming soon. To upgrade, email <a href={`mailto:${siteConfig.supportEmail}`} className="underline underline-offset-4">{siteConfig.supportEmail}</a>.
            </span>
          )}
        </p>
      )}
      <PlanPicker current={subscription.plan} trialing={trialing} canManage={can(ctx.role, "billing:manage") && selfServeUpgrades} />
    </div>
  );
}
