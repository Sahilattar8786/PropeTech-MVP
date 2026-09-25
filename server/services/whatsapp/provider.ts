import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/lib/env";

/**
 * Provider abstraction so the WhatsApp vendor can change without touching the pipeline.
 * `meta` = Meta WhatsApp Business Cloud API (production).
 * `sandbox` = local development: same webhook payloads and pipeline, but outbound
 * messages are recorded instead of sent and media comes from local storage.
 */
export type OutboundMessage =
  | { type: "text"; body: string; previewUrl?: boolean }
  | { type: "cta_url"; body: string; buttonText: string; url: string };

export interface TemplateMessage {
  name: string;
  language: string;
  bodyParameters: string[];
  /** Dynamic suffix for a URL button defined in the template. */
  buttonUrlParameter?: string;
}

export interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
}

export interface WhatsAppProvider {
  readonly name: "meta" | "sandbox";
  /** Phone number id messages are sent from. */
  readonly phoneNumberId: string;
  /** Human-facing business number brokers message (digits only). */
  readonly businessNumber: string;
  sendMessage(to: string, message: OutboundMessage): Promise<{ messageId: string }>;
  sendTemplate(to: string, template: TemplateMessage): Promise<{ messageId: string }>;
  downloadMedia(mediaId: string): Promise<DownloadedMedia>;
  /** GET webhook handshake: returns the challenge to echo back, or null. */
  verifyWebhook(params: URLSearchParams): string | null;
  /** POST webhook authenticity check (X-Hub-Signature-256). */
  verifySignature(rawBody: string, signatureHeader: string | null): boolean;
}

export const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

export function hubSignature(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

export function signatureMatches(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(hubSignature(rawBody, secret));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function verifySubscription(params: URLSearchParams, verifyToken: string | undefined): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) return challenge;
  return null;
}

let cached: WhatsAppProvider | null = null;

export async function getWhatsAppProvider(): Promise<WhatsAppProvider> {
  if (cached) return cached;
  const e = env();
  const choice = e.WHATSAPP_PROVIDER ?? (e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID ? "meta" : "sandbox");
  if (choice === "meta") {
    const { MetaCloudProvider } = await import("./meta-cloud.provider");
    cached = new MetaCloudProvider();
  } else {
    const { SandboxProvider } = await import("./sandbox.provider");
    cached = new SandboxProvider();
  }
  return cached;
}
