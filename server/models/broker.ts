import { Schema } from "mongoose";
import { defineModel, tenantScoped, type ObjectId } from "./_shared";

export interface IBroker {
  _id: ObjectId;
  tenantId: ObjectId;
  slug: string;
  businessName: string;
  contactName: string;
  tagline?: string;
  description?: string;
  phone?: string;
  /** Digits only, with country code (e.g. 919876543210). */
  whatsappNumber: string;
  email?: string;
  city?: string;
  website?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  brandColor?: string;
  /** Verified custom domain (denormalised from Domain for fast URL building). */
  customDomain?: string;
  propertyIdPrefix: string;
  whatsapp: {
    /** Sender numbers verified to submit properties over WhatsApp (digits only). */
    senderNumbers: string[];
    connectCode?: string;
    connectCodeExpiresAt?: Date;
    connectedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const brokerSchema = new Schema<IBroker>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    tagline: { type: String, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000 },
    phone: String,
    whatsappNumber: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    city: { type: String, trim: true },
    website: String,
    logoUrl: String,
    profileImageUrl: String,
    brandColor: String,
    customDomain: { type: String, lowercase: true },
    propertyIdPrefix: { type: String, required: true, uppercase: true },
    whatsapp: {
      senderNumbers: { type: [String], default: [], index: true },
      connectCode: { type: String, index: { sparse: true } },
      connectCodeExpiresAt: Date,
      connectedAt: Date,
    },
  },
  { timestamps: true },
);
tenantScoped(brokerSchema, { index: false });
brokerSchema.index({ tenantId: 1 }, { unique: true });

export const Broker = defineModel<IBroker>("Broker", brokerSchema);
