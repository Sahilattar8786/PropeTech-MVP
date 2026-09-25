import { connectDB } from "@/server/db/connect";
import { Property, WhatsAppMessage } from "@/server/models";
import { deliverAnalyticsEvent } from "@/server/services/analytics/track";
import { notifyDraftReady, notifyProcessingFailed } from "@/server/services/notifications/notification.service";
import { toPropertyDTO } from "@/server/services/properties/property.mapper";
import { NOT_A_PROPERTY_MESSAGE, processPropertyWithAI } from "@/server/services/properties/property-ingestion.service";
import { processConversationBatch } from "@/server/services/whatsapp/whatsapp-message.service";
import { processPropertyImage, processWhatsAppMedia } from "@/server/services/whatsapp/whatsapp-media.service";
import { helpMessage } from "@/server/services/whatsapp/whatsapp-template.service";
import { sendToConversation } from "@/server/services/whatsapp/whatsapp.service";
import type { JobMeta, JobPayloads, Processor, QueueName } from "./jobs";

/**
 * PropertyProcessingWorker: AI extraction/enrichment for a draft, then WhatsApp
 * bookkeeping (message status + broker notification) for WhatsApp-sourced drafts.
 */
async function processPropertyAI(payload: JobPayloads["property-ai-processing"], meta: JobMeta) {
  const { tenantId, propertyId, notifyBroker } = payload;
  const { ok, doc } = await processPropertyWithAI(tenantId, propertyId, { finalAttempt: meta.attempt >= meta.maxAttempts });
  if (!doc || doc.source?.type !== "whatsapp") return;
  await connectDB();
  const conversationId = doc.source.conversationId ? String(doc.source.conversationId) : null;
  const messageFilter = { tenantId, propertyId: doc._id, direction: "inbound" as const };

  if (ok) {
    await WhatsAppMessage.updateMany({ ...messageFilter, processingStatus: "processing" }, { $set: { processingStatus: "completed" } });
    if (notifyBroker && conversationId) await notifyDraftReady(conversationId, toPropertyDTO(doc));
    return;
  }

  const hasImages = (await WhatsAppMessage.countDocuments({ ...messageFilter, type: "image" })) > 0;
  if (doc.ingestion?.error === NOT_A_PROPERTY_MESSAGE && !hasImages) {
    // Chit-chat, not a listing: discard the empty draft and explain how to use the service.
    await WhatsAppMessage.updateMany(messageFilter, { $set: { processingStatus: "ignored" }, $unset: { propertyId: 1 } });
    await Property.deleteOne({ _id: doc._id, tenantId, status: "draft" });
    if (conversationId) await sendToConversation(conversationId, helpMessage());
    return;
  }
  await WhatsAppMessage.updateMany(messageFilter, { $set: { processingStatus: "failed", error: doc.ingestion?.error } });
  if (notifyBroker && conversationId) await notifyProcessingFailed(conversationId, propertyId);
}

export const processors: { [Q in QueueName]: Processor<Q> } = {
  "whatsapp-message-processing": (payload) => processConversationBatch(payload),
  "whatsapp-media-processing": (payload, meta) => processWhatsAppMedia(payload, meta),
  "property-ai-processing": (payload, meta) => processPropertyAI(payload, meta),
  "property-image-processing": (payload, meta) => processPropertyImage(payload, meta),
  "analytics-processing": (payload) => deliverAnalyticsEvent(payload.event),
};
