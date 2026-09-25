import { Schema } from "mongoose";
import { defineModel, tenantScoped, type ObjectId } from "./_shared";

export const LEAD_STATUSES = ["new", "contacted", "qualified", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["property_page", "broker_page", "collection_page", "whatsapp"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export interface ILead {
  _id: ObjectId;
  tenantId: ObjectId;
  propertyId?: ObjectId;
  collectionId?: ObjectId;
  source: LeadSource;
  sourceUrl?: string;
  status: LeadStatus;
  /** Snapshot of what the customer enquired about (title, price, property ID). */
  interest: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  /** Hashed visitor fingerprint used to de-duplicate repeated clicks. */
  visitorHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    collectionId: { type: Schema.Types.ObjectId, ref: "Collection" },
    source: { type: String, enum: LEAD_SOURCES, required: true },
    sourceUrl: String,
    status: { type: String, enum: LEAD_STATUSES, default: "new" },
    interest: { type: String, required: true, maxlength: 300 },
    customerName: { type: String, maxlength: 120 },
    customerPhone: String,
    notes: { type: String, maxlength: 2000 },
    visitorHash: String,
  },
  { timestamps: true },
);
tenantScoped(leadSchema);
leadSchema.index({ tenantId: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, status: 1 });

export const Lead = defineModel<ILead>("Lead", leadSchema);
