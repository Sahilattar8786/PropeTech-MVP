import { cache } from "react";
import { PUBLIC_STATUSES, type PropertyDTO, type PropertyType, type ListingType } from "@/lib/domain/property";
import { connectDB } from "@/server/db/connect";
import { Property, type IProperty } from "@/server/models";
import { toPropertyDTO } from "./property.mapper";

/** Public reads only ever return published (active/reserved) listings. */
const PUBLIC_FILTER = { status: { $in: PUBLIC_STATUSES } };

/** Fields never exposed publicly (raw WhatsApp text, AI internals). */
function publicDTO(doc: IProperty): PropertyDTO {
  const dto = toPropertyDTO(doc);
  return { ...dto, ingestion: undefined, aiMetadata: undefined, fieldSources: {}, source: undefined };
}

export const getPublicProperty = cache(async (tenantId: string, slug: string): Promise<PropertyDTO | null> => {
  await connectDB();
  const doc = await Property.findOne({ tenantId, slug: slug.toLowerCase(), ...PUBLIC_FILTER }).lean<IProperty>();
  return doc ? publicDTO(doc) : null;
});

export async function listPublicProperties(
  tenantId: string,
  opts: { q?: string; type?: PropertyType; listing?: ListingType; limit?: number } = {},
): Promise<PropertyDTO[]> {
  await connectDB();
  const query: Record<string, unknown> = { tenantId, ...PUBLIC_FILTER };
  if (opts.type) query.propertyType = opts.type;
  if (opts.listing) query.listingType = opts.listing;
  if (opts.q) {
    const re = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ title: re }, { "location.locality": re }, { "location.city": re }, { propertyId: re }];
  }
  const docs = await Property.find(query)
    .sort({ status: 1, publishedAt: -1 })
    .limit(opts.limit ?? 60)
    .lean<IProperty[]>();
  return docs.map(publicDTO);
}

export async function getSimilarProperties(property: PropertyDTO, limit = 3): Promise<PropertyDTO[]> {
  await connectDB();
  const docs = await Property.find({
    tenantId: property.tenantId,
    _id: { $ne: property.id },
    ...PUBLIC_FILTER,
    $or: [
      { propertyType: property.propertyType },
      ...(property.location?.locality ? [{ "location.locality": property.location.locality }] : []),
    ],
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<IProperty[]>();
  return docs.map(publicDTO);
}

export async function getPublicPropertiesByIds(tenantId: string, ids: string[]): Promise<PropertyDTO[]> {
  if (ids.length === 0) return [];
  await connectDB();
  const docs = await Property.find({ tenantId, _id: { $in: ids }, ...PUBLIC_FILTER }).lean<IProperty[]>();
  const byId = new Map(docs.map((d) => [String(d._id), publicDTO(d)]));
  return ids.map((id) => byId.get(id)).filter((p): p is PropertyDTO => Boolean(p));
}
