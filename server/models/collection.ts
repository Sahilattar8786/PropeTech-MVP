import { Schema } from "mongoose";
import { LISTING_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES, type ListingType, type PropertyStatus, type PropertyType } from "@/lib/domain/property";
import { defineModel, tenantScoped, type ObjectId } from "./_shared";

/** Filter rules for smart collections (kept modular — enabled per plan later). */
export interface CollectionRules {
  locality?: string;
  city?: string;
  propertyType?: PropertyType;
  listingType?: ListingType;
  bedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  status?: PropertyStatus;
}

export interface ICollection {
  _id: ObjectId;
  tenantId: ObjectId;
  name: string;
  slug: string;
  description?: string;
  type: "manual" | "smart";
  /** Ordered list of member properties for manual collections. */
  propertyIds: ObjectId[];
  rules?: CollectionRules;
  isPublic: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const collectionSchema = new Schema<ICollection>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    type: { type: String, enum: ["manual", "smart"], default: "manual" },
    propertyIds: [{ type: Schema.Types.ObjectId, ref: "Property" }],
    rules: {
      locality: String,
      city: String,
      propertyType: { type: String, enum: PROPERTY_TYPES },
      listingType: { type: String, enum: LISTING_TYPES },
      bedrooms: Number,
      minPrice: Number,
      maxPrice: Number,
      status: { type: String, enum: PROPERTY_STATUSES },
    },
    isPublic: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);
tenantScoped(collectionSchema);
collectionSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

export const Collection = defineModel<ICollection>("Collection", collectionSchema);
