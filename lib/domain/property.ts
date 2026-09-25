/** Shared property domain definitions — safe to import from client and server. */

export const PROPERTY_TYPES = [
  "apartment",
  "flat",
  "villa",
  "bungalow",
  "house",
  "plot",
  "office",
  "shop",
  "warehouse",
  "commercial",
  "other",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  flat: "Flat",
  villa: "Villa",
  bungalow: "Bungalow",
  house: "Independent House",
  plot: "Plot",
  office: "Office",
  shop: "Shop",
  warehouse: "Warehouse",
  commercial: "Commercial",
  other: "Property",
};

/** Types for which bedroom count / BHK is meaningful. */
export const RESIDENTIAL_TYPES: PropertyType[] = ["apartment", "flat", "villa", "bungalow", "house"];

export const LISTING_TYPES = ["sale", "rent"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];
export const LISTING_TYPE_LABELS: Record<ListingType, string> = { sale: "Sale", rent: "Rent" };

export const PROPERTY_STATUSES = ["draft", "active", "reserved", "sold", "rented", "delisted"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Draft",
  active: "Active",
  reserved: "Reserved",
  sold: "Sold",
  rented: "Rented",
  delisted: "Delisted",
};

/** Statuses visible on public broker pages. */
export const PUBLIC_STATUSES: PropertyStatus[] = ["active", "reserved"];

/**
 * Lifecycle state machine.
 * DRAFT → ACTIVE → RESERVED → SOLD/RENTED; ACTIVE → DELISTED; brokers can relist.
 */
export const STATUS_TRANSITIONS: Record<PropertyStatus, PropertyStatus[]> = {
  draft: ["active"],
  active: ["reserved", "sold", "rented", "delisted"],
  reserved: ["active", "sold", "rented", "delisted"],
  sold: ["active", "delisted"],
  rented: ["active", "delisted"],
  delisted: ["active"],
};

export function canTransition(from: PropertyStatus, to: PropertyStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export const FURNISHING_TYPES = ["unfurnished", "semi_furnished", "fully_furnished"] as const;
export type Furnishing = (typeof FURNISHING_TYPES)[number];
export const FURNISHING_LABELS: Record<Furnishing, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi Furnished",
  fully_furnished: "Fully Furnished",
};

export const AREA_UNITS = ["sqft", "sqm"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

/** Fields the AI pipeline may populate; used for "AI Generated" badges and field provenance. */
export const AI_FIELDS = [
  "title",
  "propertyType",
  "listingType",
  "bedrooms",
  "bathrooms",
  "area",
  "price",
  "location",
  "furnishing",
  "parking",
  "amenities",
  "description",
  "highlights",
  "seo",
] as const;
export type AIField = (typeof AI_FIELDS)[number];

export type FieldSource = { source: "ai"; confidence: number } | { source: "broker" };

export const INGESTION_STAGES = ["received", "processing", "ai_processing", "completed", "failed"] as const;
export type IngestionStage = (typeof INGESTION_STAGES)[number];

/** Processing states surfaced in the WhatsApp inbox. */
export type PipelineState =
  | "received"
  | "processing"
  | "ai_processing"
  | "draft_ready"
  | "reviewed"
  | "published"
  | "failed";

export const PIPELINE_STATE_LABELS: Record<PipelineState, string> = {
  received: "Received",
  processing: "Processing",
  ai_processing: "AI Processing",
  draft_ready: "Draft Ready",
  reviewed: "Reviewed",
  published: "Published",
  failed: "Failed",
};

export interface PropertyLocation {
  address?: string;
  locality?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyDTO {
  id: string;
  tenantId: string;
  propertyId?: string;
  title: string;
  slug?: string;
  propertyType: PropertyType;
  listingType?: ListingType;
  status: PropertyStatus;
  price?: { amount: number; currency: "INR" };
  area?: { value: number; unit: AreaUnit };
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  furnishing?: Furnishing;
  location?: PropertyLocation;
  amenities: string[];
  highlights: string[];
  images: string[];
  videos: string[];
  description?: string;
  seo?: { metaTitle?: string; metaDescription?: string };
  source?: { type: "whatsapp" | "dashboard" | "api"; messageId?: string };
  aiMetadata?: { generatedFields: string[]; confidenceScore?: number; provider?: string; warnings?: string[] };
  fieldSources: Record<string, FieldSource>;
  ingestion?: { stage: IngestionStage; error?: string; rawText?: string; attempts?: number };
  collectionIds: string[];
  views: number;
  whatsappClicks: number;
  reviewedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function pipelineStateOf(p: Pick<PropertyDTO, "status" | "ingestion" | "reviewedAt">): PipelineState {
  const stage = p.ingestion?.stage;
  if (stage === "failed") return "failed";
  if (stage === "received") return "received";
  if (stage === "processing") return "processing";
  if (stage === "ai_processing") return "ai_processing";
  if (p.status !== "draft") return "published";
  return p.reviewedAt ? "reviewed" : "draft_ready";
}
