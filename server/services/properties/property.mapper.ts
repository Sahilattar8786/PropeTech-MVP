import type { FieldSource, PropertyDTO } from "@/lib/domain/property";
import type { IProperty } from "@/server/models";

type PropertyLike = IProperty & { fieldSources?: Map<string, FieldSource> | Record<string, FieldSource> };

function sourcesToObject(value: PropertyLike["fieldSources"]): Record<string, FieldSource> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...(value as Record<string, FieldSource>) };
}

const iso = (d?: Date) => (d ? new Date(d).toISOString() : undefined);

/** Converts a Mongoose document or lean object into a serialisable DTO. */
export function toPropertyDTO(doc: PropertyLike): PropertyDTO {
  return {
    id: String(doc._id),
    tenantId: String(doc.tenantId),
    propertyId: doc.propertyId ?? undefined,
    title: doc.title,
    slug: doc.slug ?? undefined,
    propertyType: doc.propertyType,
    listingType: doc.listingType ?? undefined,
    status: doc.status,
    price: doc.price?.amount ? { amount: doc.price.amount, currency: "INR" } : undefined,
    area: doc.area?.value ? { value: doc.area.value, unit: doc.area.unit } : undefined,
    bedrooms: doc.bedrooms ?? undefined,
    bathrooms: doc.bathrooms ?? undefined,
    parking: doc.parking ?? undefined,
    furnishing: doc.furnishing ?? undefined,
    location: doc.location
      ? {
          address: doc.location.address ?? undefined,
          locality: doc.location.locality ?? undefined,
          city: doc.location.city ?? undefined,
          state: doc.location.state ?? undefined,
          pincode: doc.location.pincode ?? undefined,
          latitude: doc.location.latitude ?? undefined,
          longitude: doc.location.longitude ?? undefined,
        }
      : undefined,
    amenities: doc.amenities ?? [],
    highlights: doc.highlights ?? [],
    images: doc.images ?? [],
    videos: doc.videos ?? [],
    description: doc.description ?? undefined,
    seo: doc.seo?.metaTitle || doc.seo?.metaDescription ? { metaTitle: doc.seo.metaTitle, metaDescription: doc.seo.metaDescription } : undefined,
    source: doc.source?.type ? { type: doc.source.type, messageId: doc.source.messageId ?? undefined } : undefined,
    aiMetadata: doc.aiMetadata?.generatedFields
      ? {
          generatedFields: doc.aiMetadata.generatedFields,
          confidenceScore: doc.aiMetadata.confidenceScore ?? undefined,
          provider: doc.aiMetadata.provider ?? undefined,
          warnings: doc.aiMetadata.warnings ?? undefined,
        }
      : undefined,
    fieldSources: sourcesToObject(doc.fieldSources),
    ingestion: doc.ingestion?.stage
      ? {
          stage: doc.ingestion.stage,
          error: doc.ingestion.error ?? undefined,
          rawText: doc.ingestion.rawText ?? undefined,
          attempts: doc.ingestion.attempts ?? undefined,
        }
      : undefined,
    collectionIds: (doc.collectionIds ?? []).map(String),
    views: doc.views ?? 0,
    whatsappClicks: doc.whatsappClicks ?? 0,
    reviewedAt: iso(doc.reviewedAt),
    publishedAt: iso(doc.publishedAt),
    createdAt: iso(doc.createdAt)!,
    updatedAt: iso(doc.updatedAt)!,
  };
}
