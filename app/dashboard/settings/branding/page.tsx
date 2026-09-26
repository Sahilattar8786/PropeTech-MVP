import type { Metadata } from "next";
import { BrandingForm } from "@/features/settings/branding-form";
import { requireTenantContext } from "@/server/auth/session";
import { getEntitlements } from "@/server/services/subscriptions/subscription.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Branding" };

export default async function BrandingSettingsPage() {
  const ctx = await requireTenantContext();
  const [broker, entitlements] = await Promise.all([getBrokerForTenant(ctx.tenantId), getEntitlements(ctx.tenantId)]);
  return <BrandingForm broker={broker} allowed={entitlements.customBranding} />;
}
