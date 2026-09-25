import { Schema } from "mongoose";
import {
  AREA_UNITS,
  FURNISHING_TYPES,
  INGESTION_STAGES,
  LISTING_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type AreaUnit,
  type FieldSource,
  type Furnishing,
  type IngestionStage,
  type ListingType,
  type PropertyLocation,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/domain/property";
import { defineModel, tenantScoped, type ObjectId } from "./_shared";

export interface IProperty {
  _id: ObjectId;
  tenantId: ObjectId;
  /** Human-friendly ID assigned on publish, e.g. REH-1024. */
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
  source?: { type: "whatsapp" | "dashboard" | "api"; messageId?: string; conversationId?: ObjectId };
  aiMetadata?: {
    generatedFields: string[];
    confidenceScore?: number;
    provider?: string;
    warnings?: string[];
  };
  /** Provenance per field: AI-generated (with confidence) or broker-provided. */
  fieldSources: Map<string, FieldSource>;
  ingestion?: {
    stage: IngestionStage;
    error?: string;
    rawText?: string;
    attempts?: number;
    updatedAt?: Date;
  };
  collectionIds: ObjectId[];
  views: number;
  whatsappClicks: number;
  createdBy?: ObjectId;
  reviewedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const propertySchema = new Schema<IProperty>(
  {
    propertyId: String,
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, lowercase: true, trim: true },
    propertyType: { type: String, enum: PROPERTY_TYPES, required: true, default: "apartment" },
    listingType: { type: String, enum: LISTING_TYPES },
    status: { type: String, enum: PROPERTY_STATUSES, required: true, default: "draft" },
    price: {
      type: new Schema({ amount: { type: Number, min: 0 }, currency: { type: String, default: "INR" } }, { _id: false }),
    },
    area: {
      type: new Schema({ value: { type: Number, min: 0 }, unit: { type: String, enum: AREA_UNITS } }, { _id: false }),
    },
    bedrooms: { type: Number, min: 0, max: 50 },
    bathrooms: { type: Number, min: 0, max: 50 },
    parking: { type: Number, min: 0, max: 100 },
    furnishing: { type: String, enum: FURNISHING_TYPES },
    location: {
      type: new Schema(
        {
          address: String,
          locality: String,
          city: String,
          state: String,
          pincode: String,
          latitude: Number,
          longitude: Number,
        },
        { _id: false },
      ),
    },
    amenities: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    description: { type: String, maxlength: 5000 },
    seo: { metaTitle: String, metaDescription: String },
    source: {
      type: new Schema(
        {
          type: { type: String, enum: ["whatsapp", "dashboard", "api"] },
          messageId: String,
          conversationId: { type: Schema.Types.ObjectId, ref: "WhatsAppConversation" },
        },
        { _id: false },
      ),
    },
    aiMetadata: {
      generatedFields: { type: [String], default: undefined },
      confidenceScore: Number,
      provider: String,
      warnings: { type: [String], default: undefined },
    },
    fieldSources: { type: Map, of: Schema.Types.Mixed, default: {} },
    ingestion: {
      stage: { type: String, enum: INGESTION_STAGES },
      error: String,
      rawText: { type: String, maxlength: 10000 },
      attempts: Number,
      updatedAt: Date,
    },
    collectionIds: [{ type: Schema.Types.ObjectId, ref: "Collection" }],
    views: { type: Number, default: 0 },
    whatsappClicks: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    publishedAt: Date,
  },
  { timestamps: true },
);
tenantScoped(propertySchema);
propertySchema.index({ tenantId: 1, slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
propertySchema.index({ tenantId: 1, propertyId: 1 }, { unique: true, partialFilterExpression: { propertyId: { $type: "string" } } });
propertySchema.index({ tenantId: 1, status: 1, createdAt: -1 });
propertySchema.index({ tenantId: 1, "location.locality": 1 });
propertySchema.index({ title: "text", "location.locality": "text", "location.city": "text", description: "text" });

export const Property = defineModel<IProperty>("Property", propertySchema);
