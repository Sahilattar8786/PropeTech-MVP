import { Schema } from "mongoose";
import { defineModel, tenantScoped, type ObjectId } from "./_shared";

export interface IWhatsAppConversation {
  _id: ObjectId;
  tenantId: ObjectId;
  /** The broker's own number that sent the messages (digits only). */
  phoneNumber: string;
  /** The WhatsApp Business number that received them. */
  brokerPhoneNumber: string;
  contactName?: string;
  lastMessageAt: Date;
  lastMessagePreview?: string;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IWhatsAppConversation>(
  {
    phoneNumber: { type: String, required: true },
    brokerPhoneNumber: { type: String, required: true },
    contactName: String,
    lastMessageAt: { type: Date, required: true },
    lastMessagePreview: { type: String, maxlength: 200 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);
tenantScoped(conversationSchema);
conversationSchema.index({ tenantId: 1, phoneNumber: 1, brokerPhoneNumber: 1 }, { unique: true });
conversationSchema.index({ tenantId: 1, lastMessageAt: -1 });

export const WhatsAppConversation = defineModel<IWhatsAppConversation>("WhatsAppConversation", conversationSchema);

export const WHATSAPP_MESSAGE_TYPES = ["text", "image", "video", "document", "location", "interactive", "unsupported"] as const;
export type WhatsAppMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

export const MESSAGE_PROCESSING_STATUSES = ["pending", "processing", "completed", "failed", "ignored"] as const;
export type MessageProcessingStatus = (typeof MESSAGE_PROCESSING_STATUSES)[number];

export interface IWhatsAppMessage {
  _id: ObjectId;
  tenantId: ObjectId;
  messageId: string;
  conversationId: ObjectId;
  direction: "inbound" | "outbound";
  type: WhatsAppMessageType;
  from: string;
  to: string;
  timestamp: Date;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  /** Outbound call-to-action button (e.g. "Review Property"). */
  interactive?: { buttonText: string; url: string };
  processingStatus: MessageProcessingStatus;
  mediaStatus?: "pending" | "stored" | "failed";
  propertyId?: ObjectId;
  error?: string;
  deliveryStatus?: "sent" | "delivered" | "read" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IWhatsAppMessage>(
  {
    // Globally unique WhatsApp message id — the idempotency key for webhook retries.
    messageId: { type: String, required: true, unique: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "WhatsAppConversation", required: true, index: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    type: { type: String, enum: WHATSAPP_MESSAGE_TYPES, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    timestamp: { type: Date, required: true },
    text: { type: String, maxlength: 4096 },
    mediaId: String,
    mediaUrl: String,
    mediaMimeType: String,
    location: { latitude: Number, longitude: Number, name: String, address: String },
    interactive: { buttonText: String, url: String },
    processingStatus: { type: String, enum: MESSAGE_PROCESSING_STATUSES, default: "pending" },
    mediaStatus: { type: String, enum: ["pending", "stored", "failed"] },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    error: String,
    deliveryStatus: { type: String, enum: ["sent", "delivered", "read", "failed"] },
  },
  { timestamps: true },
);
tenantScoped(messageSchema);
messageSchema.index({ tenantId: 1, conversationId: 1, timestamp: 1 });
messageSchema.index({ conversationId: 1, direction: 1, processingStatus: 1 });

export const WhatsAppMessage = defineModel<IWhatsAppMessage>("WhatsAppMessage", messageSchema);
