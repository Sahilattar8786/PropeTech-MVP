import type { Metadata } from "next";
import { DashboardShell } from "@/features/dashboard/shell";
import { PLANS } from "@/lib/config/plans";
import { brokerBaseUrl, brokerDisplayHost } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { getNotifications } from "@/server/services/notifications/inbox-notifications.service";
import { getSubscription } from "@/server/services/subscriptions/subscription.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · PropFlow" }, robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireTenantContext();
  const [session, broker, subscription, notifications] = await Promise.all([
    getSession(),
    getBrokerForTenant(ctx.tenantId),
    getSubscription(ctx.tenantId),
    getNotifications(ctx),
  ]);
  const trialDaysLeft = subscription.status === "trialing" && subscription.trialEndsAt ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <DashboardShell
      user={{ name: ctx.name, email: ctx.email, image: session?.user?.image }}
      broker={{ businessName: broker.businessName, slug: broker.slug, logoUrl: broker.logoUrl, publicUrl: brokerBaseUrl(broker), displayHost: brokerDisplayHost(broker) }}
      plan={{ name: PLANS[subscription.plan].name, trialDaysLeft }}
      notifications={notifications}
    >
      {children}
    </DashboardShell>
  );
}
