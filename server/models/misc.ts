import { Schema } from "mongoose";
import type { PlanId } from "@/lib/config/plans";
import { DOMAIN_SETUP_STATUSES, SUBSCRIPTION_STATUSES, type DomainSetupStatus, type SubscriptionStatus } from "@/lib/domain/billing";
import { defineModel, tenantScoped, type ObjectId } from "./_shared";

/* ─────────────────────────── Media ─────────────────────────── */

export interface IMedia {
  _id: ObjectId;
  tenantId: ObjectId;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  source: "upload" | "whatsapp";
  whatsappMediaId?: string;
  originalKey?: string;
  propertyId?: ObjectId;
  /** Order within a WhatsApp batch, so images keep the order the broker sent them. */
  position?: number;
  status: "pending" | "ready" | "failed";
  error?: string;
  createdAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    key: { type: String, required: true },
    // Empty until a private original has been processed into a public image.
    url: { type: String, default: "" },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: Number,
    height: Number,
    source: { type: String, enum: ["upload", "whatsapp"], required: true },
    whatsappMediaId: String,
    originalKey: String,
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    position: Number,
    status: { type: String, enum: ["pending", "ready", "failed"], default: "ready" },
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
tenantScoped(mediaSchema);
export const Media = defineModel<IMedia>("Media", mediaSchema);

/* ─────────────────────────── Subscription ─────────────────────────── */

export interface ISubscription {
  _id: ObjectId;
  tenantId: ObjectId;
  plan: PlanId;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
  provider: "mock" | "razorpay";
  providerSubscriptionId?: string;
  /** Negotiated monthly price in ₹, set by platform admins (0 = complimentary). Unset = plan list price. */
  priceOverride?: number;
  /** Internal note from platform admins. Never shown to the broker. */
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    plan: { type: String, enum: ["free", "pro", "business"], default: "free" },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "active" },
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    provider: { type: String, enum: ["mock", "razorpay"], default: "mock" },
    providerSubscriptionId: String,
    priceOverride: { type: Number, min: 0 },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
tenantScoped(subscriptionSchema, { index: false });
subscriptionSchema.index({ tenantId: 1 }, { unique: true });
export const Subscription = defineModel<ISubscription>("Subscription", subscriptionSchema);

/* ─────────────────────────── AnalyticsEvent ─────────────────────────── */

export interface IAnalyticsEvent {
  _id: ObjectId;
  tenantId?: ObjectId;
  name: string;
  propertyId?: ObjectId;
  collectionId?: ObjectId;
  userId?: ObjectId;
  properties?: Record<string, unknown>;
  createdAt: Date;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    // Platform-level events (landing_page_view, signup_started) have no tenant.
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
    name: { type: String, required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    collectionId: { type: Schema.Types.ObjectId, ref: "Collection" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    properties: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
analyticsEventSchema.index({ tenantId: 1, name: 1, createdAt: -1 });
analyticsEventSchema.index({ tenantId: 1, propertyId: 1, createdAt: -1 });
export const AnalyticsEvent = defineModel<IAnalyticsEvent>("AnalyticsEvent", analyticsEventSchema);

/* ─────────────────────────── Domain ─────────────────────────── */

export interface IDomain {
  _id: ObjectId;
  tenantId: ObjectId;
  hostname: string;
  status: "pending" | "verified" | "failed";
  verificationToken: string;
  verifiedAt?: Date;
  lastCheckedAt?: Date;
  /** Ops workflow (adding the hostname to our hosting). Missing on domains created before it existed. */
  setupStatus?: DomainSetupStatus;
  /** Reason shown to the broker when a request is rejected. */
  rejectionReason?: string;
  setupUpdatedAt?: Date;
  removalRequestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const domainSchema = new Schema<IDomain>(
  {
    hostname: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
    verificationToken: { type: String, required: true },
    verifiedAt: Date,
    lastCheckedAt: Date,
    setupStatus: { type: String, enum: DOMAIN_SETUP_STATUSES, default: "requested" },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    setupUpdatedAt: Date,
    removalRequestedAt: Date,
  },
  { timestamps: true },
);
tenantScoped(domainSchema);
domainSchema.index({ setupStatus: 1, createdAt: -1 });
export const Domain = defineModel<IDomain>("Domain", domainSchema);

/* ─────────────────────────── AuditLog ─────────────────────────── */

export interface IAuditLog {
  _id: ObjectId;
  tenantId: ObjectId;
  actorId?: ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
tenantScoped(auditLogSchema);
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
export const AuditLog = defineModel<IAuditLog>("AuditLog", auditLogSchema);
