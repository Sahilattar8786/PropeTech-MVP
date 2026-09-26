"use server";

import { revalidatePath } from "next/cache";
import { PLAN_IDS, type PlanId } from "@/lib/config/plans";
import { brandingSchema, domainSchema, profileSchema, type BrandingInput, type DomainInput, type ProfileInput } from "@/lib/validation/settings";
import { getTenantContextOrThrow } from "@/server/auth/session";
import { AppError, runAction, type ActionResult } from "@/server/lib/errors";
import { addDomain, removeDomain, verifyDomain, type DomainDTO } from "@/server/services/domains/domain.service";
import { changePlan } from "@/server/services/subscriptions/subscription.service";
import { getBrokerForTenant, isBrokerSlugAvailable, updateBrokerBranding, updateBrokerProfile } from "@/server/services/tenants/broker.service";

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const before = await getBrokerForTenant(ctx.tenantId);
    const broker = await updateBrokerProfile(ctx, profileSchema.parse(input));
    revalidatePath(`/${before.slug}`, "layout");
    revalidatePath(`/${broker.slug}`, "layout");
    revalidatePath("/dashboard", "layout");
    return { slug: broker.slug };
  });
}

export async function checkSlugAction(slug: string): Promise<ActionResult<{ available: boolean }>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    return { available: await isBrokerSlugAvailable(slug.toLowerCase(), ctx.tenantId) };
  });
}

export async function updateBrandingAction(input: BrandingInput): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const broker = await updateBrokerBranding(ctx, brandingSchema.parse(input));
    revalidatePath(`/${broker.slug}`, "layout");
    revalidatePath("/dashboard", "layout");
  });
}

export async function addDomainAction(input: DomainInput): Promise<ActionResult<DomainDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const domain = await addDomain(ctx, domainSchema.parse(input));
    revalidatePath("/dashboard/settings/domain");
    return domain;
  });
}

export async function verifyDomainAction(id: string): Promise<ActionResult<DomainDTO>> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    const domain = await verifyDomain(ctx, id);
    revalidatePath("/dashboard", "layout");
    return domain;
  });
}

export async function removeDomainAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await getTenantContextOrThrow();
    await removeDomain(ctx, id);
    revalidatePath("/dashboard", "layout");
  });
}

export async function changePlanAction(plan: PlanId): Promise<ActionResult> {
  return runAction(async () => {
    if (!PLAN_IDS.includes(plan)) throw new AppError("BAD_REQUEST", "Unknown plan");
    const ctx = await getTenantContextOrThrow();
    await changePlan(ctx, plan);
    revalidatePath("/dashboard", "layout");
  });
}
