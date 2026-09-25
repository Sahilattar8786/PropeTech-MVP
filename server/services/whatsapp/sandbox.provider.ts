import { randomUUID } from "node:crypto";
import { normalizePhone } from "@/lib/phone";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { storage } from "@/server/services/storage/storage";
import {
  signatureMatches,
  verifySubscription,
  type DownloadedMedia,
  type OutboundMessage,
  type TemplateMessage,
  type WhatsAppProvider,
} from "./provider";

export const SANDBOX_PHONE_NUMBER_ID = "sandbox";
export const sandboxMediaKey = (mediaId: string) => `private/sandbox/${mediaId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

/**
 * Development provider. Webhook payloads are identical to Meta's, so the whole
 * pipeline (webhook → queue → media → AI → draft → notification) runs unchanged.
 */
export class SandboxProvider implements WhatsAppProvider {
  readonly name = "sandbox" as const;
  readonly phoneNumberId = SANDBOX_PHONE_NUMBER_ID;
  readonly businessNumber = normalizePhone(env().WHATSAPP_BUSINESS_NUMBER) ?? "15550001234";

  async sendMessage(to: string, message: OutboundMessage) {
    logger.info(`[whatsapp:sandbox] → ${to}: ${message.body.split("\n")[0]}`);
    return { messageId: `wamid.sandbox.${randomUUID()}` };
  }

  async sendTemplate(to: string, template: TemplateMessage) {
    logger.info(`[whatsapp:sandbox] template ${template.name} → ${to}`);
    return { messageId: `wamid.sandbox.${randomUUID()}` };
  }

  async downloadMedia(mediaId: string): Promise<DownloadedMedia> {
    const file = await (await storage()).get(sandboxMediaKey(mediaId));
    if (!file) throw new AppError("NOT_FOUND", "Sandbox media not found");
    return { buffer: file.body, mimeType: file.contentType === "application/octet-stream" ? "image/jpeg" : file.contentType };
  }

  verifyWebhook(params: URLSearchParams) {
    return verifySubscription(params, env().WHATSAPP_VERIFY_TOKEN);
  }

  verifySignature(rawBody: string, header: string | null) {
    const secret = env().WHATSAPP_APP_SECRET;
    return secret ? signatureMatches(rawBody, header, secret) : true;
  }
}
