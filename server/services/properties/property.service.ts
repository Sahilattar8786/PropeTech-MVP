import type { HydratedDocument } from "mongoose";
import { AI_FIELDS, canTransition, type FieldSource, type PropertyDTO, type PropertyStatus } from "@/lib/domain/property";
import { propertyPublicUrl } from "@/lib/urls";
import { formToPatch, publishBlockers, type PropertyFilters, type PropertyFormValues, type PropertyPatch } from "@/lib/validation/property";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import { Broker, Collection, isObjectId, Lead, Media, ObjectId, Property, Tenant, type IBroker, type IProperty } from "@/server/models";
import { propertySlugBase } from "@/server/services/ai/copywriter";
import { trackEvent } from "@/server/services/analytics/track";
import { audit } from "@/server/services/audit/audit.service";
import { enqueue } from "@/server/services/queue/queue";
import { storage } from "@/server/services/storage/storage";
import { assertCanCreateProperty } from "@/server/services/subscriptions/subscription.service";
import { toPropertyDTO } from "./property.mapper";
import { processPropertyWithAI } from "./property-ingestion.service";

export const PAGE_SIZE = 12;

async function findOwned(ctx: TenantContext, id: string): Promise<HydratedDocument<IProperty>> {
  if (!isObjectId(id)) throw notFound("Property");
  await connectDB();
  const doc = await Property.findOne({ _id: id, tenantId: ctx.tenantId });
  if (!doc) throw notFound("Property");
  return doc;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listProperties(ctx: TenantContext, filters: PropertyFilters) {
  assertCan(ctx, "property:read");
  await connectDB();
  const query: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.type) query.propertyType = filters.type;
  if (filters.listing) query.listingType = filters.listing;
  if (filters.bhk) query.bedrooms = filters.bhk;
  if (filters.locality) query["location.locality"] = new RegExp(escapeRegex(filters.locality), "i");
  if (filters.minPrice || filters.maxPrice) {
    query["price.amount"] = {
      ...(filters.minPrice ? { $gte: filters.minPrice } : {}),
      ...(filters.maxPrice ? { $lte: filters.maxPrice } : {}),
    };
  }
  if (filters.q) {
    const re = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ title: re }, { "location.locality": re }, { "location.city": re }, { propertyId: re }];
  }
  const [items, total] = await Promise.all([
    Property.find(query)
      .sort({ updatedAt: -1 })
      .skip((filters.page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean<IProperty[]>(),
    Property.countDocuments(query),
  ]);
  return { items: items.map(toPropertyDTO), total, page: filters.page, pageSize: PAGE_SIZE };
}

export async function getProperty(ctx: TenantContext, id: string): Promise<PropertyDTO> {
  assertCan(ctx, "property:read");
  return toPropertyDTO(await findOwned(ctx, id));
}

export async function listLocalities(ctx: TenantContext): Promise<string[]> {
  await connectDB();
  const values = await Property.distinct("location.locality", { tenantId: ctx.tenantId });
  return (values as (string | null)[]).filter((v): v is string => Boolean(v)).sort();
}

/** Creates an empty draft for manual entry. */
export async function createManualDraft(ctx: TenantContext): Promise<PropertyDTO> {
  assertCan(ctx, "property:write");
  await connectDB();
  await assertCanCreateProperty(ctx.tenantId);
  const doc = await Property.create({
    tenantId: ctx.tenantId,
    title: "Untitled property",
    propertyType: "apartment",
    status: "draft",
    source: { type: "dashboard" },
    createdBy: ctx.userId,
  });
  trackEvent("property_created", { tenantId: ctx.tenantId, propertyId: String(doc._id), userId: ctx.userId, properties: { source: "dashboard", mode: "manual" } });
  return toPropertyDTO(doc);
}

/** Dashboard flow: pasted WhatsApp-style text + uploaded images → AI draft (processed inline). */
export async function createDraftFromText(ctx: TenantContext, input: { text: string; images: string[] }): Promise<PropertyDTO> {
  assertCan(ctx, "property:write");
  await connectDB();
  await assertCanCreateProperty(ctx.tenantId);
  await assertOwnImages(ctx.tenantId, input.images);
  const doc = await Property.create({
    tenantId: ctx.tenantId,
    title: "New property",
    propertyType: "apartment",
    status: "draft",
    images: input.images,
    source: { type: "dashboard" },
    ingestion: { stage: "ai_processing", rawText: input.text, attempts: 0, updatedAt: new Date() },
    createdBy: ctx.userId,
  });
  trackEvent("property_created", { tenantId: ctx.tenantId, propertyId: String(doc._id), userId: ctx.userId, properties: { source: "dashboard", mode: "ai" } });
  const { doc: processed } = await processPropertyWithAI(ctx.tenantId, String(doc._id));
  return toPropertyDTO(processed ?? doc);
}

export async function retryAIProcessing(ctx: TenantContext, id: string): Promise<void> {
  assertCan(ctx, "property:write");
  const doc = await findOwned(ctx, id);
  if (!doc.ingestion?.rawText) throw new AppError("BAD_REQUEST", "This property has no message text to process");
  doc.set("ingestion.stage", "processing");
  doc.set("ingestion.error", undefined);
  await doc.save();
  await enqueue("property-ai-processing", { tenantId: ctx.tenantId, propertyId: id, notifyBroker: doc.source?.type === "whatsapp" });
}

/** Ensures image URLs attached to a property were uploaded by this tenant. */
async function assertOwnImages(tenantId: string, images: string[]) {
  if (images.length === 0) return;
  const owned = await Media.countDocuments({ tenantId, url: { $in: images } });
  if (owned !== new Set(images).size) throw new AppError("FORBIDDEN", "One or more images could not be verified");
}

function comparable(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== "");
    return JSON.stringify(Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))));
  }
  return String(value);
}

/** Applies editor changes. Any AI field the broker changes becomes broker-owned. */
function applyPatch(doc: HydratedDocument<IProperty>, patch: PropertyPatch) {
  const before = toPropertyDTO(doc);
  const sources: Map<string, FieldSource> = doc.fieldSources ?? new Map();
  for (const field of AI_FIELDS) {
    if (field === "seo") continue;
    const oldValue = comparable(before[field as keyof PropertyDTO]);
    const newValue = comparable(patch[field as keyof PropertyPatch]);
    if (oldValue !== newValue) sources.set(field, { source: "broker" });
  }
  doc.fieldSources = sources;
  doc.set({
    title: patch.title,
    propertyType: patch.propertyType,
    listingType: patch.listingType,
    price: patch.price,
    area: patch.area,
    bedrooms: patch.bedrooms,
    bathrooms: patch.bathrooms,
    parking: patch.parking,
    furnishing: patch.furnishing,
    location: patch.location,
    amenities: patch.amenities,
    highlights: patch.highlights,
    description: patch.description,
    images: patch.images,
  });
  if (doc.aiMetadata?.generatedFields) {
    doc.set(
      "aiMetadata.generatedFields",
      doc.aiMetadata.generatedFields.filter((f) => (sources.get(f) as FieldSource | undefined)?.source !== "broker"),
    );
  }
}

export async function updateProperty(ctx: TenantContext, id: string, values: PropertyFormValues, opts: { markReviewed?: boolean } = {}) {
  assertCan(ctx, "property:write");
  const doc = await findOwned(ctx, id);
  const patch = formToPatch(values);
  const newImages = patch.images.filter((url) => !doc.images.includes(url));
  await assertOwnImages(ctx.tenantId, newImages);
  if (doc.status !== "draft") {
    const blockers = publishBlockers(patch);
    if (blockers.length) throw new AppError("VALIDATION", `A live listing needs: ${blockers.join(", ")}`);
  }
  applyPatch(doc, patch);
  if (opts.markReviewed) doc.reviewedAt = new Date();
  await doc.save();
  await Media.updateMany({ tenantId: ctx.tenantId, url: { $in: newImages } }, { $set: { propertyId: doc._id } });
  return toPropertyDTO(doc);
}

async function nextPropertyId(tenantId: string, prefix: string): Promise<string> {
  const tenant = await Tenant.findByIdAndUpdate(tenantId, { $inc: { propertySeq: 1 } }, { new: true }).select("propertySeq");
  if (!tenant) throw notFound("Workspace");
  return `${prefix}-${tenant.propertySeq}`;
}

async function uniqueSlug(tenantId: string, base: string, excludeId: string): Promise<string> {
  let candidate = base;
  for (let i = 2; await Property.exists({ tenantId, slug: candidate, _id: { $ne: excludeId } }); i++) {
    candidate = `${base}-${i}`;
  }
  return candidate;
}

/**
 * Publish flow: validate → generate propertyId → generate slug → status = active
 * → public URL → track publish event. AI drafts are never published automatically.
 */
export async function publishProperty(ctx: TenantContext, id: string, values?: PropertyFormValues) {
  assertCan(ctx, "property:publish");
  const doc = await findOwned(ctx, id);
  if (values) {
    const patch = formToPatch(values);
    await assertOwnImages(ctx.tenantId, patch.images.filter((url) => !doc.images.includes(url)));
    applyPatch(doc, patch);
  }
  if (doc.status !== "draft" && doc.status !== "delisted") throw new AppError("CONFLICT", "This property is already published");
  const blockers = publishBlockers(toPropertyDTO(doc));
  if (blockers.length) throw new AppError("VALIDATION", `Add the following before publishing: ${blockers.join(", ")}`);

  const broker = await Broker.findOne({ tenantId: ctx.tenantId }).lean<IBroker>();
  if (!broker) throw notFound("Broker profile");
  if (!doc.propertyId) doc.propertyId = await nextPropertyId(ctx.tenantId, broker.propertyIdPrefix);
  if (!doc.slug) {
    const base = propertySlugBase({ bedrooms: doc.bedrooms ?? null, propertyType: doc.propertyType, location: doc.location ? { address: null, locality: doc.location.locality ?? null, city: doc.location.city ?? null, state: null, pincode: null } : null });
    doc.slug = await uniqueSlug(ctx.tenantId, base, id);
  }
  doc.status = "active";
  doc.publishedAt ??= new Date();
  doc.reviewedAt ??= new Date();
  if (doc.ingestion?.stage === "failed") doc.set("ingestion.stage", "completed");
  await doc.save();
  await Media.updateMany({ tenantId: ctx.tenantId, url: { $in: doc.images } }, { $set: { propertyId: doc._id } });

  trackEvent("property_published", { tenantId: ctx.tenantId, propertyId: id, userId: ctx.userId });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "property.published", { type: "property", id }, { propertyId: doc.propertyId });
  return { property: toPropertyDTO(doc), publicUrl: propertyPublicUrl(broker, doc.slug), brokerSlug: broker.slug };
}

export async function changePropertyStatus(ctx: TenantContext, id: string, status: PropertyStatus) {
  assertCan(ctx, "property:publish");
  const doc = await findOwned(ctx, id);
  if (doc.status === "draft" || (doc.status === "delisted" && status === "active" && !doc.slug)) {
    throw new AppError("BAD_REQUEST", "Review and publish this draft first");
  }
  if (!canTransition(doc.status, status)) {
    throw new AppError("BAD_REQUEST", `Can't change status from ${doc.status} to ${status}`);
  }
  const from = doc.status;
  doc.status = status;
  await doc.save();
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "property.status_changed", { type: "property", id }, { from, to: status });
  const broker = await Broker.findOne({ tenantId: ctx.tenantId }).select("slug").lean<Pick<IBroker, "slug">>();
  return { property: toPropertyDTO(doc), brokerSlug: broker?.slug };
}

export async function deleteProperty(ctx: TenantContext, id: string) {
  assertCan(ctx, "property:delete");
  const doc = await findOwned(ctx, id);
  const media = await Media.find({ tenantId: ctx.tenantId, $or: [{ propertyId: doc._id }, { url: { $in: doc.images } }] }).select("key");
  await Promise.all([
    Collection.updateMany({ tenantId: ctx.tenantId }, { $pull: { propertyIds: doc._id } }),
    Lead.updateMany({ tenantId: ctx.tenantId, propertyId: doc._id }, { $set: { notes: `Property "${doc.title}" was deleted` } }),
    Property.deleteOne({ _id: doc._id, tenantId: ctx.tenantId }),
  ]);
  const store = await storage();
  await Promise.allSettled(media.map((m) => store.delete(m.key)));
  await Media.deleteMany({ _id: { $in: media.map((m) => m._id) } });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "property.deleted", { type: "property", id }, { title: doc.title });
  const broker = await Broker.findOne({ tenantId: ctx.tenantId }).select("slug").lean<Pick<IBroker, "slug">>();
  return { slug: doc.slug, brokerSlug: broker?.slug };
}

export async function getDashboardStats(ctx: TenantContext) {
  await connectDB();
  const tenantId = ctx.tenantId;
  const [byStatus, totals, leads, recent, drafts] = await Promise.all([
    Property.aggregate<{ _id: PropertyStatus; count: number }>([
      { $match: { tenantId: new ObjectId(tenantId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Property.aggregate<{ views: number; clicks: number }>([
      { $match: { tenantId: new ObjectId(tenantId) } },
      { $group: { _id: null, views: { $sum: "$views" }, clicks: { $sum: "$whatsappClicks" } } },
    ]),
    Lead.countDocuments({ tenantId }),
    Property.find({ tenantId, status: { $ne: "draft" } }).sort({ views: -1 }).limit(5).lean<IProperty[]>(),
    Property.find({ tenantId, status: "draft" }).sort({ updatedAt: -1 }).limit(4).lean<IProperty[]>(),
  ]);
  const count = (s: PropertyStatus) => byStatus.find((b) => b._id === s)?.count ?? 0;
  const total = byStatus.reduce((sum, b) => sum + b.count, 0);
  return {
    total,
    active: count("active") + count("reserved"),
    sold: count("sold") + count("rented"),
    drafts: count("draft"),
    views: totals[0]?.views ?? 0,
    whatsappClicks: totals[0]?.clicks ?? 0,
    leads,
    topProperties: recent.map(toPropertyDTO),
    recentDrafts: drafts.map(toPropertyDTO),
  };
}
