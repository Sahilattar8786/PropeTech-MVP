import { randomUUID } from "node:crypto";
import { getAppUrl } from "@/lib/config/site";
import { normalizePhone } from "@/lib/phone";
import type { TenantContext } from "@/server/auth/context";
import { connectDB } from "@/server/db/connect";
import { env } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { Broker, type IBroker } from "@/server/models";
import { validateImage } from "@/server/services/media/media.service";
import { storage } from "@/server/services/storage/storage";
import { getWhatsAppProvider, hubSignature } from "./provider";
import { sandboxMediaKey } from "./sandbox.provider";

/**
 * Development harness: builds a Meta Cloud API webhook payload and POSTs it to our
 * own webhook, so the real pipeline (signature → tenant → store → queue → media → AI)
 * runs end-to-end without WhatsApp credentials. Disabled with the Meta provider.
 */
export async function simulateInboundMessage(ctx: TenantContext, input: { from: string; text?: string; images: { buffer: Buffer; mimeType: string }[] }) {
  const provider = await getWhatsAppProvider();
  if (provider.name !== "sandbox") throw new AppError("FORBIDDEN", "The simulator is only available in sandbox mode");
  await connectDB();
  const broker = await Broker.findOne({ tenantId: ctx.tenantId }).lean<IBroker>();
  if (!broker) throw new AppError("NOT_FOUND", "Broker profile not found");

  // Only allow sending as this tenant's own numbers — never another tenant's.
  const from = normalizePhone(input.from);
  const allowed = new Set([broker.whatsappNumber, ...(broker.whatsapp?.senderNumbers ?? [])]);
  if (!from || !allowed.has(from)) throw new AppError("FORBIDDEN", "You can only simulate messages from your own WhatsApp numbers");
  if (!input.text?.trim() && input.images.length === 0) throw new AppError("VALIDATION", "Add a message or at least one photo");

  const store = await storage();
  const baseTs = Math.floor(Date.now() / 1000);
  const messages: Record<string, unknown>[] = [];
  if (input.text?.trim()) {
    messages.push({ from, id: `wamid.sim.${randomUUID()}`, timestamp: String(baseTs), type: "text", text: { body: input.text.trim().slice(0, 4000) } });
  }
  for (const [i, image] of input.images.entries()) {
    await validateImage(image.buffer);
    const mediaId = `sim-${randomUUID()}`;
    await store.put(sandboxMediaKey(mediaId), image.buffer, image.mimeType);
    messages.push({ from, id: `wamid.sim.${randomUUID()}`, timestamp: String(baseTs + i + 1), type: "image", image: { id: mediaId, mime_type: image.mimeType } });
  }

  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "sandbox-waba",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: provider.businessNumber, phone_number_id: provider.phoneNumberId },
              contacts: [{ wa_id: from, profile: { name: broker.contactName } }],
              messages,
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(payload);
  const secret = env().WHATSAPP_APP_SECRET;
  const res = await fetch(`${getAppUrl()}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "X-Hub-Signature-256": hubSignature(body, secret) } : {}) },
    body,
  });
  if (!res.ok) throw new AppError("INTEGRATION", `Webhook responded ${res.status}`);
  return { messages: messages.length };
}
