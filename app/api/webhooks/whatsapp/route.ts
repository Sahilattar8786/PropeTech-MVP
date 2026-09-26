import type { NextRequest } from "next/server";
import { AppError, errorResponse } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { checkRateLimit, clientIp, RATE_LIMITS } from "@/server/lib/rate-limit";
import { getWhatsAppProvider } from "@/server/services/whatsapp/provider";
import { handleWebhookPayload, parseWebhookPayload } from "@/server/services/whatsapp/whatsapp-webhook.service";

/** GET — Meta webhook verification handshake (hub.challenge). */
export async function GET(request: NextRequest) {
  const provider = await getWhatsAppProvider();
  const params = request.nextUrl.searchParams;
  const challenge = provider.verifyWebhook(params);
  if (!challenge) {
    const reason = params.get("hub.mode") !== "subscribe" ? "hub.mode is not subscribe" : !params.get("hub.challenge") ? "missing hub.challenge" : "verify token does not match WHATSAPP_VERIFY_TOKEN";
    logger.warn(`WhatsApp webhook verification rejected: ${reason}`);
    return new Response("Forbidden", { status: 403 });
  }
  logger.info("WhatsApp webhook verified");
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * POST — incoming WhatsApp events.
 * 1. Validate signature  2. Identify tenant  3–4. Store message + WhatsApp id (idempotent)
 * 5. Classify type  6. Queue processing  7. Return quickly (no AI work here).
 */
export async function POST(request: NextRequest) {
  if (!checkRateLimit(`webhook:${clientIp(request.headers)}`, RATE_LIMITS.webhook).ok) {
    return new Response("Too Many Requests", { status: 429 });
  }
  const rawBody = await request.text();
  const provider = await getWhatsAppProvider();
  if (!provider.verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    logger.warn("Rejected WhatsApp webhook with invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }
  try {
    const result = await handleWebhookPayload(parseWebhookPayload(rawBody));
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AppError && error.code === "BAD_REQUEST") return errorResponse(error);
    // Return 500 so Meta retries; idempotency makes retries safe.
    logger.error("WhatsApp webhook processing failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
