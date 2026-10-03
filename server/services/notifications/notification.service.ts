import { dashboardUrl } from "@/lib/urls";
import type { PropertyDTO } from "@/lib/domain/property";
import { connectDB } from "@/server/db/connect";
import { logger } from "@/server/lib/logger";
import { WhatsAppConversation } from "@/server/models";
import { processingFailedMessage, draftReadyMessage, draftReadyTemplate, publishedMessage } from "@/server/services/whatsapp/whatsapp-template.service";
import { sendToConversation } from "@/server/services/whatsapp/whatsapp.service";

/** Broker notifications. WhatsApp today; email/push can be added behind the same calls. */
export async function notifyDraftReady(conversationId: string, property: PropertyDTO) {
  const reviewUrl = dashboardUrl(`/properties/${property.id}/review`);
  return sendToConversation(conversationId, draftReadyMessage(property, reviewUrl), draftReadyTemplate(property, property.id));
}

/**
 * Sends the public link to the broker's WhatsApp once a listing is published. Uses the conversation the
 * draft came from, else the broker's most recent one. Best-effort: publishing never fails because of this,
 * and outside WhatsApp's 24-hour window the message is skipped (no approved template for it).
 */
export async function notifyPublished(tenantId: string, property: PropertyDTO, publicUrl: string, conversationId?: string) {
  try {
    await connectDB();
    const target =
      conversationId ??
      String((await WhatsAppConversation.findOne({ tenantId, status: "active" }).sort({ lastMessageAt: -1 }).select("_id").lean<{ _id: unknown }>())?._id ?? "");
    if (!target) return false;
    return await sendToConversation(target, publishedMessage(property, publicUrl));
  } catch (error) {
    logger.warn("Published-listing WhatsApp notification failed", error);
    return false;
  }
}

export async function notifyProcessingFailed(conversationId: string, propertyId: string) {
  return sendToConversation(conversationId, processingFailedMessage(dashboardUrl(`/properties/${propertyId}/review`)));
}
