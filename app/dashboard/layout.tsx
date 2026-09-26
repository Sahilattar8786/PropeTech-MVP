import type { Metadata } from "next";
import { DashboardShell } from "@/features/dashboard/shell";
import { PLANS } from "@/lib/config/plans";
import { brokerBaseUrl, brokerDisplayHost } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { getNotifications } from "@/server/services/notifications/inbox-notifications.service";
import { getSubscription, trialDaysLeft } from "@/server/services/subscriptions/subscription.service";
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

  return (
    <DashboardShell
      user={{ name: ctx.name, email: ctx.email, image: session?.user?.image }}
      broker={{ businessName: broker.businessName, slug: broker.slug, logoUrl: broker.logoUrl, publicUrl: brokerBaseUrl(broker), displayHost: brokerDisplayHost(broker) }}
      plan={{ name: PLANS[subscription.plan].name, trialDaysLeft: trialDaysLeft(subscription) }}
      notifications={notifications}
    >
      {children}
    </DashboardShell>
  );
}
