import { formatArea, furnishingLabel, configurationLabel, locationLabel, priceLabel } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { PropertyDTO } from "@/lib/domain/property";
import { siteConfig } from "@/lib/config/site";
import type { OutboundMessage, TemplateMessage } from "./provider";

/**
 * All broker-facing WhatsApp copy in one place. Session messages are used inside
 * the 24-hour customer-service window; approved templates outside it.
 */

export function draftReadyMessage(property: PropertyDTO, reviewUrl: string): OutboundMessage {
  const lines = [
    "✅ *Property Draft Ready*",
    "",
    configurationLabel(property),
    locationLabel(property.location),
    property.price ? priceLabel(property) : null,
    formatArea(property.area),
    furnishingLabel(property.furnishing),
    property.parking ? `${property.parking} Parking` : null,
    property.aiMetadata?.confidenceScore !== undefined ? `\nAI confidence: ${Math.round(property.aiMetadata.confidenceScore * 100)}%` : null,
    "",
    "Review your listing before publishing:",
  ].filter((l): l is string => l !== null);
  return { type: "cta_url", body: lines.join("\n"), buttonText: "Review Property", url: reviewUrl };
}

export function draftReadyTemplate(property: PropertyDTO, propertyDbId: string): TemplateMessage {
  return {
    name: "property_draft_ready",
    language: "en",
    bodyParameters: [configurationLabel(property), locationLabel(property.location) ?? "—", property.price ? priceLabel(property) : "Price not provided"],
    buttonUrlParameter: `${propertyDbId}/review`,
  };
}

export function processingFailedMessage(reviewUrl: string): OutboundMessage {
  return {
    type: "cta_url",
    body: "⚠️ We couldn't automatically process this property.\n\nYou can review it manually or retry AI processing from your dashboard.",
    buttonText: "Review Manually",
    url: reviewUrl,
  };
}

export function helpMessage(): OutboundMessage {
  return {
    type: "text",
    body: [
      `👋 This is ${siteConfig.name}.`,
      "",
      "Send a property in one go — details and photos — for example:",
      "_3 BHK flat in Whitefield, 1800 sqft, ₹1.5 Cr, semi furnished, 2 parking_",
      "",
      "We'll turn it into a draft listing for you to review and publish.",
    ].join("\n"),
  };
}

export function connectedMessage(businessName: string): OutboundMessage {
  return {
    type: "text",
    body: `✅ This number is now connected to *${businessName}* on ${siteConfig.name}.\n\nSend property details and photos here any time — we'll prepare draft listings for you to review.`,
  };
}

export function unknownSenderMessage(): OutboundMessage {
  return {
    type: "text",
    body: `This number isn't linked to a ${siteConfig.name} account yet.\n\nOpen Settings → WhatsApp in your dashboard and send the connect code shown there.`,
  };
}

export function limitReachedMessage(): OutboundMessage {
  return { type: "text", body: "Your plan's property limit has been reached. Upgrade your plan in the dashboard to add more properties." };
}

export function connectCodeInstructions(code: string, businessNumber: string) {
  return { text: `CONNECT ${code}`, number: formatPhone(businessNumber) };
}
