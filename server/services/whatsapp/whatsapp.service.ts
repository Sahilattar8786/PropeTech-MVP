import { connectDB } from "@/server/db/connect";
import { logger } from "@/server/lib/logger";
import { WhatsAppConversation, WhatsAppMessage, type IWhatsAppConversation } from "@/server/models";
import { getWhatsAppProvider, type OutboundMessage, type TemplateMessage } from "./provider";

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * High-level WhatsApp operations used by the rest of the app. Every outbound
 * message is recorded against the conversation so it appears in the inbox.
 */
export async function sendToConversation(
  conversationId: string,
  message: OutboundMessage,
  fallbackTemplate?: TemplateMessage,
): Promise<boolean> {
  await connectDB();
  const conversation = await WhatsAppConversation.findById(conversationId).lean<IWhatsAppConversation>();
  if (!conversation) return false;
  const provider = await getWhatsAppProvider();

  const lastInbound = await WhatsAppMessage.findOne({ conversationId, direction: "inbound" }).sort({ timestamp: -1 }).select("timestamp");
  const insideWindow = lastInbound ? Date.now() - lastInbound.timestamp.getTime() < SESSION_WINDOW_MS : false;

  try {
    const { messageId } =
      insideWindow || !fallbackTemplate
        ? await provider.sendMessage(conversation.phoneNumber, message)
        : await provider.sendTemplate(conversation.phoneNumber, fallbackTemplate);
    await WhatsAppMessage.create({
      tenantId: conversation.tenantId,
      conversationId,
      messageId,
      direction: "outbound",
      type: message.type === "cta_url" ? "interactive" : "text",
      from: provider.businessNumber,
      to: conversation.phoneNumber,
      timestamp: new Date(),
      text: message.body,
      interactive: message.type === "cta_url" ? { buttonText: message.buttonText, url: message.url } : undefined,
      processingStatus: "completed",
      deliveryStatus: "sent",
    });
    await WhatsAppConversation.updateOne(
      { _id: conversationId },
      { $set: { lastMessageAt: new Date(), lastMessagePreview: message.body.replace(/[*_]/g, "").slice(0, 120) } },
    );
    return true;
  } catch (error) {
    logger.error("WhatsApp send failed", error);
    return false;
  }
}

/** Replies to a number that has no tenant yet (connect flow / unknown sender). Not persisted. */
export async function sendDirect(to: string, message: OutboundMessage): Promise<void> {
  try {
    const provider = await getWhatsAppProvider();
    await provider.sendMessage(to, message);
  } catch (error) {
    logger.warn("WhatsApp direct send failed", error);
  }
}
