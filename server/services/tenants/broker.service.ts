import { cache } from "react";
import type { BrokerDTO } from "@/lib/domain/broker";
import { brokerSlugFromName, isValidBrokerSlug, RESERVED_SLUGS } from "@/lib/slug";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import { Broker, type IBroker } from "@/server/models";
import { audit } from "@/server/services/audit/audit.service";
import type { BrandingInput, ProfileInput } from "@/lib/validation/settings";
import { normalizePhone } from "@/lib/phone";

export function toBrokerDTO(doc: IBroker): BrokerDTO {
  return {
    id: String(doc._id),
    tenantId: String(doc.tenantId),
    slug: doc.slug,
    businessName: doc.businessName,
    contactName: doc.contactName,
    tagline: doc.tagline ?? undefined,
    description: doc.description ?? undefined,
    phone: doc.phone ?? undefined,
    whatsappNumber: doc.whatsappNumber,
    email: doc.email ?? undefined,
    city: doc.city ?? undefined,
    website: doc.website ?? undefined,
    logoUrl: doc.logoUrl ?? undefined,
    profileImageUrl: doc.profileImageUrl ?? undefined,
    brandColor: doc.brandColor ?? undefined,
    customDomain: doc.customDomain ?? undefined,
    propertyIdPrefix: doc.propertyIdPrefix,
  };
}

export async function getBrokerForTenant(tenantId: string): Promise<BrokerDTO> {
  await connectDB();
  const doc = await Broker.findOne({ tenantId }).lean<IBroker>();
  if (!doc) throw notFound("Broker profile");
  return toBrokerDTO(doc);
}

/** Public lookup by slug (request-deduplicated for metadata + page). */
export const getPublicBrokerBySlug = cache(async (slug: string): Promise<BrokerDTO | null> => {
  if (!isValidBrokerSlug(slug)) return null;
  await connectDB();
  const doc = await Broker.findOne({ slug: slug.toLowerCase() }).lean<IBroker>();
  return doc ? toBrokerDTO(doc) : null;
});

export async function isBrokerSlugAvailable(slug: string, exceptTenantId?: string): Promise<boolean> {
  if (!isValidBrokerSlug(slug) || RESERVED_SLUGS.has(slug)) return false;
  await connectDB();
  const existing = await Broker.findOne({ slug }).select("tenantId").lean<Pick<IBroker, "tenantId">>();
  return !existing || (exceptTenantId !== undefined && String(existing.tenantId) === exceptTenantId);
}

export async function generateUniqueBrokerSlug(businessName: string): Promise<string> {
  const base = brokerSlugFromName(businessName);
  if (await isBrokerSlugAvailable(base)) return base;
  for (let i = 2; i < 50; i++) {
    const candidate = `${base.slice(0, 36)}${i}`;
    if (await isBrokerSlugAvailable(candidate)) return candidate;
  }
  return `${base.slice(0, 30)}${Date.now().toString(36).slice(-6)}`;
}

/** "Rehan Brokers" → "REH" — prefix for human-friendly property IDs. */
export function propertyIdPrefixFrom(businessName: string): string {
  const letters = businessName.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters.slice(0, 3) || "PRP").padEnd(3, "X");
}

export async function updateBrokerProfile(ctx: TenantContext, input: ProfileInput): Promise<BrokerDTO> {
  assertCan(ctx, "settings:write");
  await connectDB();
  const slug = input.slug.toLowerCase();
  if (!(await isBrokerSlugAvailable(slug, ctx.tenantId))) {
    throw new AppError("CONFLICT", "That website address is taken", { slug: "That website address is taken" });
  }
  const whatsappNumber = normalizePhone(input.whatsappNumber);
  if (!whatsappNumber) throw new AppError("VALIDATION", "Invalid WhatsApp number", { whatsappNumber: "Invalid WhatsApp number" });
  const doc = await Broker.findOneAndUpdate(
    { tenantId: ctx.tenantId },
    {
      $set: {
        slug,
        businessName: input.businessName,
        contactName: input.contactName,
        tagline: input.tagline || undefined,
        description: input.description || undefined,
        phone: normalizePhone(input.phone) ?? undefined,
        whatsappNumber,
        email: input.email || undefined,
        city: input.city,
        website: input.website || undefined,
      },
    },
    { new: true },
  ).lean<IBroker>();
  if (!doc) throw notFound("Broker profile");
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "broker.profile_updated", { type: "broker", id: String(doc._id) });
  return toBrokerDTO(doc);
}

export async function updateBrokerBranding(ctx: TenantContext, input: BrandingInput): Promise<BrokerDTO> {
  assertCan(ctx, "settings:write");
  await connectDB();
  const doc = await Broker.findOneAndUpdate(
    { tenantId: ctx.tenantId },
    { $set: { logoUrl: input.logoUrl || undefined, profileImageUrl: input.profileImageUrl || undefined, brandColor: input.brandColor } },
    { new: true },
  ).lean<IBroker>();
  if (!doc) throw notFound("Broker profile");
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "broker.branding_updated", { type: "broker", id: String(doc._id) });
  return toBrokerDTO(doc);
}
