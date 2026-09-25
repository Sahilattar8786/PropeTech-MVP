/** Public-safe broker profile. Never includes WhatsApp connection internals. */
export interface BrokerDTO {
  id: string;
  tenantId: string;
  slug: string;
  businessName: string;
  contactName: string;
  tagline?: string;
  description?: string;
  phone?: string;
  whatsappNumber: string;
  email?: string;
  city?: string;
  website?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  brandColor?: string;
  customDomain?: string;
  propertyIdPrefix: string;
}

export const DEFAULT_BRAND_COLOR = "#0f766e";

export function brokerFirstName(broker: Pick<BrokerDTO, "contactName" | "businessName">): string {
  return broker.contactName?.split(/\s+/)[0] || broker.businessName;
}
