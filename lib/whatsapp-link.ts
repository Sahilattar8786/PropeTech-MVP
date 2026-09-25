import { brokerFirstName } from "@/lib/domain/broker";
import type { PropertyDTO } from "@/lib/domain/property";
import { locationLabel, priceLabel } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";

type LinkProperty = Pick<PropertyDTO, "title" | "location" | "price" | "listingType" | "bedrooms" | "propertyType" | "furnishing" | "propertyId">;

/**
 * Customer → broker enquiry message:
 *   Hi Rehan,
 *   I'm interested in:
 *   Premium 3 BHK Apartment in Whitefield
 *   Whitefield
 *   ₹1.50 Cr
 *   Property ID: REH-1024
 *   Property Link:
 *   https://rehanbrokers.propflow.in/property/3bhk-whitefield
 */
export function buildEnquiryMessage(
  broker: { contactName: string; businessName: string },
  property: LinkProperty,
  propertyUrl: string,
): string {
  const lines = [
    `Hi ${brokerFirstName(broker)},`,
    "I'm interested in:",
    property.title,
    locationLabel(property.location, { short: true }),
    property.price ? priceLabel(property) : null,
    property.propertyId ? `Property ID: ${property.propertyId}` : null,
    "Property Link:",
    propertyUrl,
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

/** https://wa.me/{phone}?text={encodedMessage} */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = normalizePhone(phone) ?? phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Share sheet link for brokers forwarding a listing to anyone. */
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
