import { z } from "zod";
import {
  AREA_UNITS,
  FURNISHING_TYPES,
  LISTING_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type PropertyDTO,
} from "@/lib/domain/property";

/**
 * Editor form schema. Numeric inputs stay strings so the same schema drives the
 * React Hook Form UI and the Server Action; `formToPatch` converts them.
 */
const numeric = (label: string, opts: { integer?: boolean; max?: number } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), `${label} must be a positive number`)
    .refine((v) => v === "" || !opts.integer || Number.isInteger(Number(v)), `${label} must be a whole number`)
    .refine((v) => v === "" || opts.max === undefined || Number(v) <= opts.max, `${label} looks too large`);

export const PRICE_UNITS = ["rupees", "lakh", "crore"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];
const PRICE_MULTIPLIER: Record<PriceUnit, number> = { rupees: 1, lakh: 1e5, crore: 1e7 };

export const propertyFormSchema = z.object({
  title: z.string().trim().min(3, "Add a title (at least 3 characters)").max(160),
  propertyType: z.enum(PROPERTY_TYPES),
  listingType: z.enum([...LISTING_TYPES, ""]),
  priceValue: numeric("Price"),
  priceUnit: z.enum(PRICE_UNITS),
  areaValue: numeric("Area"),
  areaUnit: z.enum(AREA_UNITS),
  bedrooms: numeric("BHK", { max: 20 }),
  bathrooms: numeric("Bathrooms", { integer: true, max: 20 }),
  parking: numeric("Parking", { integer: true, max: 50 }),
  furnishing: z.enum([...FURNISHING_TYPES, ""]),
  address: z.string().trim().max(200),
  locality: z.string().trim().max(80),
  city: z.string().trim().max(60),
  state: z.string().trim().max(60),
  pincode: z.string().trim().refine((v) => v === "" || /^[1-9]\d{5}$/.test(v), "Enter a 6-digit pincode"),
  amenities: z.array(z.string().trim().min(1).max(40)).max(30),
  highlights: z.array(z.string().trim().min(1).max(60)).max(10),
  description: z.string().trim().max(5000),
  images: z.array(z.string().min(1)).max(20, "Up to 20 images per property"),
});
export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export type PropertyPatch = Pick<
  PropertyDTO,
  "title" | "propertyType" | "listingType" | "price" | "area" | "bedrooms" | "bathrooms" | "parking" | "furnishing" | "location" | "amenities" | "highlights" | "description" | "images"
>;

const num = (v: string) => (v === "" ? undefined : Number(v));

export function formToPatch(values: PropertyFormValues): PropertyPatch {
  const priceValue = num(values.priceValue);
  const areaValue = num(values.areaValue);
  const location = {
    address: values.address || undefined,
    locality: values.locality || undefined,
    city: values.city || undefined,
    state: values.state || undefined,
    pincode: values.pincode || undefined,
  };
  return {
    title: values.title,
    propertyType: values.propertyType,
    listingType: values.listingType || undefined,
    price: priceValue ? { amount: Math.round(priceValue * PRICE_MULTIPLIER[values.priceUnit]), currency: "INR" } : undefined,
    area: areaValue ? { value: areaValue, unit: values.areaUnit } : undefined,
    bedrooms: num(values.bedrooms),
    bathrooms: num(values.bathrooms),
    parking: num(values.parking),
    furnishing: values.furnishing || undefined,
    location: Object.values(location).some(Boolean) ? location : undefined,
    amenities: [...new Set(values.amenities)],
    highlights: values.highlights,
    description: values.description || undefined,
    images: values.images,
  };
}

function splitPrice(amount?: number): { priceValue: string; priceUnit: PriceUnit } {
  if (!amount) return { priceValue: "", priceUnit: "lakh" };
  if (amount >= 1e7) return { priceValue: String(+(amount / 1e7).toFixed(4)), priceUnit: "crore" };
  if (amount >= 1e5) return { priceValue: String(+(amount / 1e5).toFixed(3)), priceUnit: "lakh" };
  return { priceValue: String(amount), priceUnit: "rupees" };
}

export function propertyToFormValues(p: PropertyDTO): PropertyFormValues {
  const str = (v?: number) => (v === undefined || v === null ? "" : String(v));
  return {
    title: p.title,
    propertyType: p.propertyType,
    listingType: p.listingType ?? "",
    ...splitPrice(p.price?.amount),
    areaValue: str(p.area?.value),
    areaUnit: p.area?.unit ?? "sqft",
    bedrooms: str(p.bedrooms),
    bathrooms: str(p.bathrooms),
    parking: str(p.parking),
    furnishing: p.furnishing ?? "",
    address: p.location?.address ?? "",
    locality: p.location?.locality ?? "",
    city: p.location?.city ?? "",
    state: p.location?.state ?? "",
    pincode: p.location?.pincode ?? "",
    amenities: p.amenities,
    highlights: p.highlights,
    description: p.description ?? "",
    images: p.images,
  };
}

/** Fields a listing needs before it can go live. Returns human-readable gaps. */
export function publishBlockers(p: Pick<PropertyPatch, "title" | "propertyType" | "listingType" | "location">): string[] {
  const missing: string[] = [];
  if (!p.title || p.title.trim().length < 3) missing.push("Title");
  if (!p.propertyType) missing.push("Property type");
  if (!p.listingType) missing.push("Sale or rent");
  if (!p.location?.locality && !p.location?.city) missing.push("Location (locality or city)");
  return missing;
}

export const createFromTextSchema = z.object({
  text: z.string().trim().min(10, "Paste the property details (at least a few words)").max(4000),
  images: z.array(z.string().min(1)).max(20),
});
export type CreateFromTextInput = z.infer<typeof createFromTextSchema>;

export const statusChangeSchema = z.object({ status: z.enum(PROPERTY_STATUSES) });

export const propertyFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PROPERTY_STATUSES).optional(),
  type: z.enum(PROPERTY_TYPES).optional(),
  listing: z.enum(LISTING_TYPES).optional(),
  bhk: z.coerce.number().int().min(1).max(10).optional(),
  locality: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
