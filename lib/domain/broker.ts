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

/** Propsora blue at AA text contrast (the UI `--brand`); brokers on custom-branding plans pick their own. */
export const DEFAULT_BRAND_COLOR = "#0E6CDD";

export function brokerFirstName(broker: Pick<BrokerDTO, "contactName" | "businessName">): string {
  return broker.contactName?.split(/\s+/)[0] || broker.businessName;
}
