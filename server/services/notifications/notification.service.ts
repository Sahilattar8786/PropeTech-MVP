import { dashboardUrl } from "@/lib/urls";
import type { PropertyDTO } from "@/lib/domain/property";
import { processingFailedMessage, draftReadyMessage, draftReadyTemplate } from "@/server/services/whatsapp/whatsapp-template.service";
import { sendToConversation } from "@/server/services/whatsapp/whatsapp.service";

/** Broker notifications. WhatsApp today; email/push can be added behind the same calls. */
export async function notifyDraftReady(conversationId: string, property: PropertyDTO) {
  const reviewUrl = dashboardUrl(`/properties/${property.id}/review`);
  return sendToConversation(conversationId, draftReadyMessage(property, reviewUrl), draftReadyTemplate(property, property.id));
}

export async function notifyProcessingFailed(conversationId: string, propertyId: string) {
  return sendToConversation(conversationId, processingFailedMessage(dashboardUrl(`/properties/${propertyId}/review`)));
}
