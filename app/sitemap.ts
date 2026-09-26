import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/config/site";
import { PUBLIC_STATUSES } from "@/lib/domain/property";
import { brokerBaseUrl, collectionPublicUrl, propertyPublicUrl } from "@/lib/urls";
import { connectDB } from "@/server/db/connect";
import { logger } from "@/server/lib/logger";
import { Broker, Collection, Property, type IBroker, type ICollection, type IProperty } from "@/server/models";

export const revalidate = 3600;

/** Marketing pages + every public broker site, listing and collection. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/register`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    await connectDB();
    const [brokers, properties, collections] = await Promise.all([
      Broker.find().select("tenantId slug customDomain updatedAt").limit(5000).lean<IBroker[]>(),
      Property.find({ status: { $in: PUBLIC_STATUSES }, slug: { $exists: true } }).select("tenantId slug updatedAt").limit(45000).lean<IProperty[]>(),
      Collection.find({ isPublic: true }).select("tenantId slug updatedAt").limit(5000).lean<ICollection[]>(),
    ]);
    const brokerByTenant = new Map(brokers.map((b) => [String(b.tenantId), b]));
    for (const b of brokers) entries.push({ url: brokerBaseUrl(b), lastModified: b.updatedAt, changeFrequency: "daily", priority: 0.8 });
    for (const p of properties) {
      const b = brokerByTenant.get(String(p.tenantId));
      if (b && p.slug) entries.push({ url: propertyPublicUrl(b, p.slug), lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.7 });
    }
    for (const c of collections) {
      const b = brokerByTenant.get(String(c.tenantId));
      if (b) entries.push({ url: collectionPublicUrl(b, c.slug), lastModified: c.updatedAt, changeFrequency: "weekly", priority: 0.5 });
    }
  } catch (error) {
    logger.warn("Sitemap: database unavailable, returning static entries", error);
  }
  return entries;
}
