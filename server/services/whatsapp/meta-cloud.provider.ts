import { normalizePhone } from "@/lib/phone";
import { env, isProduction } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import {
  MAX_MEDIA_BYTES,
  signatureMatches,
  verifySubscription,
  type DownloadedMedia,
  type OutboundMessage,
  type TemplateMessage,
  type WhatsAppProvider,
} from "./provider";

/** Meta WhatsApp Business Cloud API. https://developers.facebook.com/docs/whatsapp/cloud-api */
export class MetaCloudProvider implements WhatsAppProvider {
  readonly name = "meta" as const;
  readonly phoneNumberId: string;
  readonly businessNumber: string;
  private readonly apiUrl: string;
  private readonly token: string;

  constructor() {
    const e = env();
    if (!e.WHATSAPP_ACCESS_TOKEN || !e.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error("Meta WhatsApp provider requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID");
    }
    if (isProduction() && !e.WHATSAPP_APP_SECRET) throw new Error("WHATSAPP_APP_SECRET is required in production");
    this.apiUrl = e.WHATSAPP_API_URL.replace(/\/+$/, "");
    this.token = e.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = e.WHATSAPP_PHONE_NUMBER_ID;
    this.businessNumber = normalizePhone(e.WHATSAPP_BUSINESS_NUMBER) ?? "";
  }

  private async graph<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.apiUrl}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AppError("INTEGRATION", `WhatsApp API ${res.status}: ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async sendMessage(to: string, message: OutboundMessage) {
    const payload =
      message.type === "text"
        ? { type: "text", text: { body: message.body, preview_url: message.previewUrl ?? true } }
        : {
            type: "interactive",
            interactive: {
              type: "cta_url",
              body: { text: message.body },
              action: { name: "cta_url", parameters: { display_text: message.buttonText, url: message.url } },
            },
          };
    const data = await this.graph<{ messages: { id: string }[] }>(`${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
    });
    return { messageId: data.messages[0]!.id };
  }

  async sendTemplate(to: string, template: TemplateMessage) {
    const components: unknown[] = [
      { type: "body", parameters: template.bodyParameters.map((text) => ({ type: "text", text })) },
    ];
    if (template.buttonUrlParameter) {
      components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: template.buttonUrlParameter }] });
    }
    const data = await this.graph<{ messages: { id: string }[] }>(`${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template.name, language: { code: template.language }, components },
      }),
    });
    return { messageId: data.messages[0]!.id };
  }

  async downloadMedia(mediaId: string): Promise<DownloadedMedia> {
    // Step 1: resolve the short-lived media URL. Step 2: download it with the same token.
    const meta = await this.graph<{ url: string; mime_type: string; file_size?: number }>(encodeURIComponent(mediaId));
    if (meta.file_size && meta.file_size > MAX_MEDIA_BYTES) throw new AppError("BAD_REQUEST", "Media file is too large");
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new AppError("INTEGRATION", `Media download failed (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_MEDIA_BYTES) throw new AppError("BAD_REQUEST", "Media file is too large");
    return { buffer, mimeType: meta.mime_type };
  }

  verifyWebhook(params: URLSearchParams) {
    return verifySubscription(params, env().WHATSAPP_VERIFY_TOKEN);
  }

  verifySignature(rawBody: string, header: string | null) {
    const secret = env().WHATSAPP_APP_SECRET;
    if (!secret) return !isProduction();
    return signatureMatches(rawBody, header, secret);
  }
}
