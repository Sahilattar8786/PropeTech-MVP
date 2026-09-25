import { z } from "zod";
import { AREA_UNITS, FURNISHING_TYPES, LISTING_TYPES, PROPERTY_TYPES } from "@/lib/domain/property";

export interface PropertyAIInput {
  /** Raw broker text (WhatsApp message body + image captions). */
  text: string;
  /** Image URLs supplied with the message. Not used to derive facts. */
  images: string[];
  context?: { brokerCity?: string };
  /** Grounded facts from extraction — present when calling `enrichProperty`. */
  facts?: PropertyFacts;
}

const nullableString = z.string().trim().min(1).nullable();

export const locationSchema = z.object({
  address: nullableString,
  locality: nullableString,
  city: nullableString,
  state: nullableString,
  pincode: nullableString,
});

/** Facts about the property. Every value must be supported by the broker's text. */
export const propertyFactsSchema = z.object({
  isProperty: z.boolean(),
  propertyType: z.enum(PROPERTY_TYPES).nullable(),
  listingType: z.enum(LISTING_TYPES).nullable(),
  bedrooms: z.number().min(0).max(20).nullable(),
  bathrooms: z.number().int().min(0).max(20).nullable(),
  location: locationSchema.nullable(),
  area: z.object({ value: z.number().positive(), unit: z.enum(AREA_UNITS) }).nullable(),
  price: z.object({ amount: z.number().positive(), currency: z.literal("INR") }).nullable(),
  furnishing: z.enum(FURNISHING_TYPES).nullable(),
  parking: z.number().int().min(0).max(50).nullable(),
  amenities: z.array(z.string().trim().min(1)).max(30),
});
export type PropertyFacts = z.infer<typeof propertyFactsSchema>;

/** Marketing copy generated from facts. */
export const propertyCopySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(3000).nullable(),
  highlights: z.array(z.string().trim().min(1).max(60)).max(10),
  seo: z
    .object({
      metaTitle: z.string().trim().max(90),
      metaDescription: z.string().trim().max(200),
      slug: z.string().trim().max(80),
    })
    .nullable(),
});
export type PropertyCopy = z.infer<typeof propertyCopySchema>;

export const FACT_KEYS = [
  "propertyType",
  "listingType",
  "bedrooms",
  "bathrooms",
  "location",
  "area",
  "price",
  "furnishing",
  "parking",
  "amenities",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

/** Output shape shared by both provider methods (extraction leaves `copy` null). */
export interface PropertyAIOutput {
  facts: PropertyFacts;
  copy: PropertyCopy | null;
  /** Provider's per-field confidence (0–1). */
  fieldConfidence: Partial<Record<FactKey, number>>;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  extractProperty(input: PropertyAIInput): Promise<PropertyAIOutput>;
  enrichProperty(input: PropertyAIInput): Promise<PropertyAIOutput>;
}

export const EMPTY_FACTS: PropertyFacts = {
  isProperty: false,
  propertyType: null,
  listingType: null,
  bedrooms: null,
  bathrooms: null,
  location: null,
  area: null,
  price: null,
  furnishing: null,
  parking: null,
  amenities: [],
};
