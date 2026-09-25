import { pipelineStateOf, type PipelineState, type PropertyDTO } from "@/lib/domain/property";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { isObjectId, ObjectId, Property, WhatsAppConversation, WhatsAppMessage, type IProperty, type IWhatsAppConversation, type IWhatsAppMessage } from "@/server/models";
import { toPropertyDTO } from "@/server/services/properties/property.mapper";

export interface ConversationDTO {
  id: string;
  phoneNumber: string;
  contactName?: string;
  lastMessageAt: string;
  lastMessagePreview?: string;
  pendingCount: number;
}

export interface InboxMessageDTO {
  id: string;
  direction: "inbound" | "outbound";
  type: IWhatsAppMessage["type"];
  text?: string;
  hasMedia: boolean;
  mediaStatus?: IWhatsAppMessage["mediaStatus"];
  imageUrl?: string;
  interactive?: { buttonText: string; url: string };
  processingStatus: IWhatsAppMessage["processingStatus"];
  propertyId?: string;
  timestamp: string;
}

export interface InboxSubmissionDTO {
  property: PropertyDTO;
  state: PipelineState;
  failedMedia: number;
}

export async function listConversations(ctx: TenantContext): Promise<ConversationDTO[]> {
  assertCan(ctx, "whatsapp:read");
  await connectDB();
  const conversations = await WhatsAppConversation.find({ tenantId: ctx.tenantId, status: "active" })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .lean<IWhatsAppConversation[]>();
  const pending = await WhatsAppMessage.aggregate<{ _id: unknown; count: number }>([
    { $match: { tenantId: new ObjectId(ctx.tenantId), direction: "inbound", processingStatus: { $in: ["pending", "processing"] } } },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);
  const pendingById = new Map(pending.map((p) => [String(p._id), p.count]));
  return conversations.map((c) => ({
    id: String(c._id),
    phoneNumber: c.phoneNumber,
    contactName: c.contactName ?? undefined,
    lastMessageAt: c.lastMessageAt.toISOString(),
    lastMessagePreview: c.lastMessagePreview ?? undefined,
    pendingCount: pendingById.get(String(c._id)) ?? 0,
  }));
}

/** Messages (never exposed publicly) plus the property drafts they produced. */
export async function getConversation(ctx: TenantContext, conversationId: string) {
  assertCan(ctx, "whatsapp:read");
  if (!isObjectId(conversationId)) return null;
  await connectDB();
  const conversation = await WhatsAppConversation.findOne({ _id: conversationId, tenantId: ctx.tenantId }).lean<IWhatsAppConversation>();
  if (!conversation) return null;
  const messages = await WhatsAppMessage.find({ tenantId: ctx.tenantId, conversationId })
    .sort({ timestamp: 1, _id: 1 })
    .limit(300)
    .lean<IWhatsAppMessage[]>();
  const propertyIds = [...new Set(messages.map((m) => m.propertyId).filter(Boolean).map(String))];
  const properties = await Property.find({ tenantId: ctx.tenantId, _id: { $in: propertyIds } }).lean<IProperty[]>();
  const propertyById = new Map(properties.map((p) => [String(p._id), toPropertyDTO(p)]));

  const submissions: Record<string, InboxSubmissionDTO> = {};
  for (const [id, property] of propertyById) {
    submissions[id] = {
      property,
      state: pipelineStateOf(property),
      failedMedia: messages.filter((m) => String(m.propertyId) === id && m.mediaStatus === "failed").length,
    };
  }

  // Show each image with its processed listing photo when available.
  const imageByPropertyIndex = new Map<string, number>();
  const items: InboxMessageDTO[] = messages.map((m) => {
    let imageUrl: string | undefined;
    if (m.type === "image" && m.propertyId && m.mediaStatus === "stored") {
      const key = String(m.propertyId);
      const index = imageByPropertyIndex.get(key) ?? 0;
      imageByPropertyIndex.set(key, index + 1);
      imageUrl = propertyById.get(key)?.images[index];
    }
    return {
      id: String(m._id),
      direction: m.direction,
      type: m.type,
      text: m.text ?? undefined,
      hasMedia: Boolean(m.mediaId),
      mediaStatus: m.mediaStatus ?? undefined,
      imageUrl,
      interactive: m.interactive?.url ? { buttonText: m.interactive.buttonText, url: m.interactive.url } : undefined,
      processingStatus: m.processingStatus,
      propertyId: m.propertyId ? String(m.propertyId) : undefined,
      timestamp: m.timestamp.toISOString(),
    };
  });

  return {
    conversation: {
      id: String(conversation._id),
      phoneNumber: conversation.phoneNumber,
      contactName: conversation.contactName ?? undefined,
    },
    messages: items,
    submissions,
  };
}
