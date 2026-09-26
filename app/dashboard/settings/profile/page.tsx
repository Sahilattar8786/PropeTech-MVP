import type { Metadata } from "next";
import { ProfileForm } from "@/features/settings/profile-form";
import { requireTenantContext } from "@/server/auth/session";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const ctx = await requireTenantContext();
  const broker = await getBrokerForTenant(ctx.tenantId);
  return <ProfileForm broker={broker} />;
}
