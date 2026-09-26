import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DomainManager } from "@/features/settings/domain-manager";
import { brokerDisplayHost } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { listDomains } from "@/server/services/domains/domain.service";
import { getEntitlements } from "@/server/services/subscriptions/subscription.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Custom domain" };

export default async function DomainSettingsPage() {
  const ctx = await requireTenantContext();
  const [broker, entitlements, domains] = await Promise.all([getBrokerForTenant(ctx.tenantId), getEntitlements(ctx.tenantId), listDomains(ctx)]);
  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <p className="text-sm text-muted-foreground">Your website is live at</p>
        <p className="mt-1 flex items-center gap-2 font-mono font-medium">
          <Globe className="size-4 text-brand" /> {brokerDisplayHost(broker)}
        </p>
      </section>
      {entitlements.customDomain ? (
        <DomainManager domains={domains} />
      ) : (
        <section className="rounded-2xl border border-dashed bg-surface p-6 text-center">
          <Lock className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-3 font-semibold">Use your own domain</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Serve your broker website from www.yourbusiness.com. Available on the Business plan.</p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/settings/billing">View plans</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
