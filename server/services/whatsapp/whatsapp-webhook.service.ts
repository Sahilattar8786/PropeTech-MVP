import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { connectDB } from "@/server/db/connect";
import { AppError, isDuplicateKeyError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { WhatsAppConversation, WhatsAppMessage, type IBroker, type WhatsAppMessageType } from "@/server/models";
import { trackEvent } from "@/server/services/analytics/track";
import { findBrokerBySender, redeemConnectCode } from "./connection.service";
import { scheduleConversationBatch } from "./whatsapp-message.service";
import { connectedMessage, helpMessage, unknownSenderMessage } from "./whatsapp-template.service";
import { sendDirect, sendToConversation } from "./whatsapp.service";

/* Meta webhook payload — validated leniently: unknown fields are ignored. */
const mediaSchema = z.object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() });
const inboundMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: mediaSchema.optional(),
  video: mediaSchema.optional(),
  document: mediaSchema.extend({ filename: z.string().optional() }).optional(),
  location: z
    .object({ latitude: z.number(), longitude: z.number(), name: z.string().optional(), address: z.string().optional() })
    .optional(),
});
const statusSchema = z.object({ id: z.string(), status: z.string() });
export const webhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string().optional(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({ display_phone_number: z.string().optional(), phone_number_id: z.string() }).optional(),
            contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string().optional() }).optional() })).optional(),
            messages: z.array(inboundMessageSchema).optional(),
            statuses: z.array(statusSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
type InboundMessage = z.infer<typeof inboundMessageSchema>;

const SUPPORTED_TYPES: WhatsAppMessageType[] = ["text", "image", "video", "document", "location"];
const CONNECT_PATTERN = /^\s*connect\s+([a-z0-9]{6})\s*$/i;
const HELP_PATTERN = /^\s*(help|hi|hello|hey|start)\s*[!.]*\s*$/i;

export function parseWebhookPayload(rawBody: string): WebhookPayload {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid JSON");
  }
  const parsed = webhookPayloadSchema.safeParse(json);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Unrecognised webhook payload");
  return parsed.data;
}

/**
 * Handles a verified webhook delivery. Heavy work (media download, AI) is queued —
 * this function only stores messages so the HTTP response returns quickly.
 */
export async function handleWebhookPayload(payload: WebhookPayload): Promise<{ stored: number; duplicates: number }> {
  if (payload.object !== "whatsapp_business_account") return { stored: 0, duplicates: 0 };
  await connectDB();
  let stored = 0;
  let duplicates = 0;

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const { value } = change;
      const businessNumber = normalizePhone(value.metadata?.display_phone_number) ?? value.metadata?.phone_number_id ?? "unknown";

      for (const status of value.statuses ?? []) {
        if (["sent", "delivered", "read", "failed"].includes(status.status)) {
          await WhatsAppMessage.updateOne({ messageId: status.id }, { $set: { deliveryStatus: status.status } });
        }
      }

      for (const message of value.messages ?? []) {
        const contactName = value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name;
        const result = await handleInboundMessage(message, businessNumber, contactName);
        if (result === "stored") stored++;
        if (result === "duplicate") duplicates++;
      }
    }
  }
  return { stored, duplicates };
}

async function handleInboundMessage(message: InboundMessage, businessNumber: string, contactName?: string) {
  // Idempotency: Meta retries deliveries — a known message id is acknowledged and skipped.
  if (await WhatsAppMessage.exists({ messageId: message.id })) return "duplicate" as const;

  const from = normalizePhone(message.from) ?? message.from;
  const text = message.text?.body ?? message.image?.caption ?? message.video?.caption ?? message.document?.caption;
  const broker = await findBrokerBySender(from);

  if (broker) return storeTenantMessage(broker, message, { from, businessNumber, contactName, text });

  // Unknown number: the only thing it may do is redeem a connect code.
  const connected = await tryConnect(from, text);
  if (!connected) return "ignored" as const;
  return storeTenantMessage(connected, message, { from, businessNumber, contactName, text });
}

async function tryConnect(from: string, text?: string): Promise<IBroker | null> {
  const code = text ? CONNECT_PATTERN.exec(text)?.[1] : undefined;
  if (!code) {
    // Don't store messages from numbers without a tenant; reply at most once an hour.
    if (checkRateLimit(`wa-unknown:${from}`, { limit: 1, windowMs: 60 * 60_000 }).ok) await sendDirect(from, unknownSenderMessage());
    return null;
  }
  try {
    const broker = await redeemConnectCode(code, from);
    if (!broker) await sendDirect(from, { type: "text", body: "That connect code is invalid or has expired. Open Settings → WhatsApp in your dashboard for a fresh code." });
    return broker;
  } catch (error) {
    await sendDirect(from, { type: "text", body: error instanceof AppError ? error.message : "We couldn't connect this number." });
    return null;
  }
}

async function storeTenantMessage(
  broker: IBroker,
  message: InboundMessage,
  meta: { from: string; businessNumber: string; contactName?: string; text?: string },
) {
  const tenantId = broker.tenantId;
  const type = (SUPPORTED_TYPES.includes(message.type as WhatsAppMessageType) ? message.type : "unsupported") as WhatsAppMessageType;
  const media = message.image ?? message.video ?? message.document;
  const timestamp = new Date(Number(message.timestamp) * 1000 || Date.now());

  const conversation = await WhatsAppConversation.findOneAndUpdate(
    { tenantId, phoneNumber: meta.from, brokerPhoneNumber: meta.businessNumber },
    {
      $set: {
        lastMessageAt: timestamp,
        lastMessagePreview: (meta.text ?? (type === "image" ? "📷 Photo" : `[${type}]`)).slice(0, 120),
        status: "active",
        ...(meta.contactName ? { contactName: meta.contactName } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const isHelp = type === "text" && meta.text !== undefined && HELP_PATTERN.test(meta.text);
  const isConnect = type === "text" && meta.text !== undefined && CONNECT_PATTERN.test(meta.text);
  const processable = (type === "text" || type === "image") && !isHelp && !isConnect;

  try {
    await WhatsAppMessage.create({
      tenantId,
      messageId: message.id,
      conversationId: conversation._id,
      direction: "inbound",
      type,
      from: meta.from,
      to: meta.businessNumber,
      timestamp,
      text: meta.text,
      mediaId: media?.id,
      mediaMimeType: media?.mime_type,
      mediaStatus: type === "image" ? "pending" : undefined,
      location: message.location,
      processingStatus: processable ? "pending" : "ignored",
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return "duplicate" as const;
    throw error;
  }

  trackEvent("whatsapp_message_received", { tenantId: String(tenantId), properties: { type } });

  if (isConnect) {
    await sendToConversation(String(conversation._id), connectedMessage(broker.businessName));
  } else if (isHelp) {
    await sendToConversation(String(conversation._id), helpMessage());
  } else if (processable) {
    await scheduleConversationBatch(String(tenantId), String(conversation._id));
  } else {
    logger.info(`WhatsApp ${type} message stored without processing (MVP supports text and images)`);
  }
  return "stored" as const;
}
