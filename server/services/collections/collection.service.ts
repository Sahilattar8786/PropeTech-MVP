import { cache } from "react";
import { slugify } from "@/lib/slug";
import type { CollectionDTO, CollectionFormValues } from "@/lib/validation/collection";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import { Broker, Collection, isObjectId, Property, type ICollection, type IProperty, type CollectionRules, type IBroker } from "@/server/models";
import { audit } from "@/server/services/audit/audit.service";
import { assertCanCreateCollection } from "@/server/services/subscriptions/subscription.service";
import { toPropertyDTO } from "@/server/services/properties/property.mapper";
import type { PropertyDTO } from "@/lib/domain/property";
import { PUBLIC_STATUSES } from "@/lib/domain/property";

/** Smart (rule-based) collections are modelled and resolvable, but not yet exposed in the UI. */
export const SMART_COLLECTIONS_ENABLED = false;

function toDTO(doc: ICollection, coverImage?: string): CollectionDTO {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? undefined,
    type: doc.type,
    propertyIds: doc.propertyIds.map(String),
    propertyCount: doc.propertyIds.length,
    coverImage,
    views: doc.views ?? 0,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function findOwned(ctx: TenantContext, id: string) {
  if (!isObjectId(id)) throw notFound("Collection");
  await connectDB();
  const doc = await Collection.findOne({ _id: id, tenantId: ctx.tenantId });
  if (!doc) throw notFound("Collection");
  return doc;
}

async function uniqueCollectionSlug(tenantId: string, base: string, excludeId?: string) {
  const root = base || "collection";
  let candidate = root;
  for (let i = 2; await Collection.exists({ tenantId, slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i++) {
    candidate = `${root}-${i}`;
  }
  return candidate;
}

/** Builds the Mongo filter for a smart collection's rules. */
export function rulesToQuery(tenantId: string, rules: CollectionRules): Record<string, unknown> {
  const q: Record<string, unknown> = { tenantId, status: rules.status ?? { $in: PUBLIC_STATUSES } };
  if (rules.locality) q["location.locality"] = new RegExp(`^${rules.locality.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (rules.city) q["location.city"] = rules.city;
  if (rules.propertyType) q.propertyType = rules.propertyType;
  if (rules.listingType) q.listingType = rules.listingType;
  if (rules.bedrooms) q.bedrooms = rules.bedrooms;
  if (rules.minPrice || rules.maxPrice) {
    q["price.amount"] = { ...(rules.minPrice ? { $gte: rules.minPrice } : {}), ...(rules.maxPrice ? { $lte: rules.maxPrice } : {}) };
  }
  return q;
}

/** Resolves member properties in order, for either collection type. */
async function resolveProperties(doc: ICollection, opts: { publicOnly: boolean }): Promise<PropertyDTO[]> {
  const tenantId = String(doc.tenantId);
  if (doc.type === "smart" && doc.rules) {
    const items = await Property.find(rulesToQuery(tenantId, doc.rules)).sort({ publishedAt: -1 }).limit(100).lean<IProperty[]>();
    return items.map(toPropertyDTO);
  }
  const query: Record<string, unknown> = { tenantId, _id: { $in: doc.propertyIds } };
  if (opts.publicOnly) query.status = { $in: PUBLIC_STATUSES };
  const items = await Property.find(query).lean<IProperty[]>();
  const byId = new Map(items.map((p) => [String(p._id), toPropertyDTO(p)]));
  return doc.propertyIds.map((id) => byId.get(String(id))).filter((p): p is PropertyDTO => Boolean(p));
}

export async function listCollections(ctx: TenantContext): Promise<CollectionDTO[]> {
  await connectDB();
  const docs = await Collection.find({ tenantId: ctx.tenantId }).sort({ updatedAt: -1 }).lean<ICollection[]>();
  const firstIds = docs.map((d) => d.propertyIds[0]).filter(Boolean);
  const covers = await Property.find({ tenantId: ctx.tenantId, _id: { $in: firstIds } }).select("images").lean<Pick<IProperty, "_id" | "images">[]>();
  const coverById = new Map(covers.map((c) => [String(c._id), c.images[0]]));
  return docs.map((d) => toDTO(d, d.propertyIds[0] ? coverById.get(String(d.propertyIds[0])) : undefined));
}

export async function getCollectionWithProperties(ctx: TenantContext, id: string) {
  const doc = await findOwned(ctx, id);
  const properties = await resolveProperties(doc, { publicOnly: false });
  return { collection: toDTO(doc, properties[0]?.images[0]), properties };
}

export async function createCollection(ctx: TenantContext, input: CollectionFormValues): Promise<CollectionDTO> {
  assertCan(ctx, "collection:write");
  await connectDB();
  await assertCanCreateCollection(ctx.tenantId);
  const slug = await uniqueCollectionSlug(ctx.tenantId, slugify(input.slug || input.name, { maxLength: 60 }));
  const doc = await Collection.create({ tenantId: ctx.tenantId, name: input.name, slug, description: input.description || undefined, type: "manual", propertyIds: [] });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "collection.created", { type: "collection", id: String(doc._id) });
  return toDTO(doc);
}

export async function updateCollection(ctx: TenantContext, id: string, input: CollectionFormValues): Promise<CollectionDTO> {
  assertCan(ctx, "collection:write");
  const doc = await findOwned(ctx, id);
  const desired = slugify(input.slug || input.name, { maxLength: 60 });
  if (desired !== doc.slug) {
    if (await Collection.exists({ tenantId: ctx.tenantId, slug: desired, _id: { $ne: doc._id } })) {
      throw new AppError("CONFLICT", "Another collection already uses that link", { slug: "Another collection already uses that link" });
    }
    doc.slug = desired;
  }
  doc.name = input.name;
  doc.description = input.description || undefined;
  await doc.save();
  return toDTO(doc);
}

export async function deleteCollection(ctx: TenantContext, id: string) {
  assertCan(ctx, "collection:write");
  const doc = await findOwned(ctx, id);
  await Property.updateMany({ tenantId: ctx.tenantId }, { $pull: { collectionIds: doc._id } });
  await Collection.deleteOne({ _id: doc._id, tenantId: ctx.tenantId });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "collection.deleted", { type: "collection", id }, { name: doc.name });
  return { slug: doc.slug };
}

export async function addPropertiesToCollection(ctx: TenantContext, id: string, propertyIds: string[]) {
  assertCan(ctx, "collection:write");
  const doc = await findOwned(ctx, id);
  const valid = propertyIds.filter(isObjectId);
  // Only properties owned by this tenant can be added.
  const owned = await Property.find({ tenantId: ctx.tenantId, _id: { $in: valid } }).select("_id").lean<{ _id: IProperty["_id"] }[]>();
  const existing = new Set(doc.propertyIds.map(String));
  const toAdd = owned.map((p) => p._id).filter((pid) => !existing.has(String(pid)));
  if (toAdd.length === 0) return toDTO(doc);
  doc.propertyIds.push(...toAdd);
  await doc.save();
  await Property.updateMany({ tenantId: ctx.tenantId, _id: { $in: toAdd } }, { $addToSet: { collectionIds: doc._id } });
  return toDTO(doc);
}

export async function removePropertyFromCollection(ctx: TenantContext, id: string, propertyId: string) {
  assertCan(ctx, "collection:write");
  const doc = await findOwned(ctx, id);
  doc.propertyIds = doc.propertyIds.filter((pid) => String(pid) !== propertyId);
  await doc.save();
  if (isObjectId(propertyId)) await Property.updateOne({ tenantId: ctx.tenantId, _id: propertyId }, { $pull: { collectionIds: doc._id } });
  return toDTO(doc);
}

export async function reorderCollection(ctx: TenantContext, id: string, orderedIds: string[]) {
  assertCan(ctx, "collection:write");
  const doc = await findOwned(ctx, id);
  const current = doc.propertyIds.map(String);
  if (orderedIds.length !== current.length || !orderedIds.every((pid) => current.includes(pid))) {
    throw new AppError("BAD_REQUEST", "The collection changed — refresh and try again");
  }
  doc.propertyIds = orderedIds.map((pid) => doc.propertyIds.find((p) => String(p) === pid)!);
  await doc.save();
  return toDTO(doc);
}

/* ─────────────── Public ─────────────── */

export const getPublicCollection = cache(async (tenantId: string, slug: string) => {
  await connectDB();
  const doc = await Collection.findOne({ tenantId, slug: slug.toLowerCase(), isPublic: true }).lean<ICollection>();
  if (!doc) return null;
  const properties = await resolveProperties(doc, { publicOnly: true });
  return { collection: toDTO(doc, properties[0]?.images[0]), properties };
});

export async function listPublicCollections(tenantId: string): Promise<CollectionDTO[]> {
  await connectDB();
  const docs = await Collection.find({ tenantId, isPublic: true, "propertyIds.0": { $exists: true } }).sort({ updatedAt: -1 }).limit(12).lean<ICollection[]>();
  const firstIds = docs.map((d) => d.propertyIds[0]);
  const covers = await Property.find({ tenantId, _id: { $in: firstIds } }).select("images").lean<Pick<IProperty, "_id" | "images">[]>();
  const coverById = new Map(covers.map((c) => [String(c._id), c.images[0]]));
  return docs.map((d) => toDTO(d, coverById.get(String(d.propertyIds[0]))));
}

export async function incrementCollectionViews(collectionId: string) {
  if (!isObjectId(collectionId)) return null;
  await connectDB();
  const doc = await Collection.findOneAndUpdate({ _id: collectionId }, { $inc: { views: 1 } }, { projection: { tenantId: 1 } }).lean<Pick<ICollection, "tenantId">>();
  return doc ? String(doc.tenantId) : null;
}

export async function getBrokerSlugForTenant(tenantId: string) {
  const broker = await Broker.findOne({ tenantId }).select("slug customDomain").lean<Pick<IBroker, "slug" | "customDomain">>();
  return broker ?? null;
}
