import { connectDB } from "@/server/db/connect";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { Property, WhatsAppMessage, type IWhatsAppMessage } from "@/server/models";
import { trackEvent } from "@/server/services/analytics/track";
import { enqueue } from "@/server/services/queue/queue";
import { assertCanCreateProperty } from "@/server/services/subscriptions/subscription.service";
import { limitReachedMessage } from "./whatsapp-template.service";
import { sendToConversation } from "./whatsapp.service";

/**
 * Brokers usually send a property as a burst: one text plus several photos, each a
 * separate WhatsApp message. We wait for a short window after the first pending
 * message, then turn everything pending in the conversation into one draft.
 */
export async function scheduleConversationBatch(tenantId: string, conversationId: string) {
  const first = await WhatsAppMessage.findOne({ tenantId, conversationId, direction: "inbound", processingStatus: "pending" })
    .sort({ timestamp: 1, _id: 1 })
    .select("_id");
  if (!first) return;
  // Same first-pending message ⇒ same job id ⇒ the queue de-duplicates the burst.
  await enqueue(
    "whatsapp-message-processing",
    { tenantId, conversationId },
    { jobId: `wa-batch-${String(first._id)}`, delayMs: env().WHATSAPP_BATCH_WINDOW_MS },
  );
}

/** Queue processor: pending messages → property draft → media + AI jobs. */
export async function processConversationBatch({ tenantId, conversationId }: { tenantId: string; conversationId: string }) {
  await connectDB();
  const pending = await WhatsAppMessage.find({ tenantId, conversationId, direction: "inbound", processingStatus: "pending" })
    .sort({ timestamp: 1, _id: 1 })
    .lean<IWhatsAppMessage[]>();
  if (pending.length === 0) return;

  // Claim the batch so concurrent jobs can't process the same messages.
  const ids = pending.map((m) => m._id);
  const claim = await WhatsAppMessage.updateMany({ _id: { $in: ids }, processingStatus: "pending" }, { $set: { processingStatus: "processing" } });
  if (claim.modifiedCount === 0) return;

  const rawText = pending
    .map((m) => m.text?.trim())
    .filter(Boolean)
    .join("\n");
  const images = pending.filter((m) => m.type === "image" && m.mediaId);

  try {
    await assertCanCreateProperty(tenantId);
  } catch (error) {
    if (error instanceof AppError && error.code === "LIMIT_EXCEEDED") {
      await WhatsAppMessage.updateMany({ _id: { $in: ids } }, { $set: { processingStatus: "failed", error: error.message } });
      await sendToConversation(conversationId, limitReachedMessage());
      return;
    }
    throw error;
  }

  const property = await Property.create({
    tenantId,
    title: "New property from WhatsApp",
    propertyType: "apartment",
    status: "draft",
    source: { type: "whatsapp", messageId: pending[0]!.messageId, conversationId },
    ingestion: { stage: "processing", rawText, attempts: 0, updatedAt: new Date() },
  });
  const propertyId = String(property._id);
  await WhatsAppMessage.updateMany({ _id: { $in: ids } }, { $set: { propertyId: property._id } });
  trackEvent("property_created", { tenantId, propertyId, properties: { source: "whatsapp", images: images.length } });

  for (const message of images) {
    await enqueue("whatsapp-media-processing", { tenantId, messageId: message.messageId, propertyId });
  }
  await enqueue("property-ai-processing", { tenantId, propertyId, notifyBroker: true });
  logger.info(`WhatsApp batch → draft ${propertyId} (${pending.length} messages, ${images.length} images)`);
}
