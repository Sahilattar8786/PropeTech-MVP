"use client";

import { track } from "@/lib/analytics-client";
import type { PropertyDTO } from "@/lib/domain/property";
import { cn } from "@/lib/utils";
import { buildEnquiryMessage, buildWhatsAppUrl } from "@/lib/whatsapp-link";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";

type ButtonProperty = Pick<PropertyDTO, "id" | "title" | "location" | "price" | "listingType" | "bedrooms" | "propertyType" | "furnishing" | "propertyId">;

/**
 * "I'm Interested — WhatsApp Broker". Opens wa.me with the property context and
 * records the click (→ lead) without delaying the customer.
 */
export function WhatsAppButton({
  brokerPhone,
  brokerName,
  businessName,
  property,
  propertyUrl,
  label = "I'm Interested — WhatsApp Broker",
  className,
  size = "lg",
}: {
  brokerPhone: string;
  brokerName: string;
  businessName: string;
  property: ButtonProperty;
  propertyUrl: string;
  label?: string;
  className?: string;
  size?: "md" | "lg";
}) {
  const href = buildWhatsAppUrl(brokerPhone, buildEnquiryMessage({ contactName: brokerName, businessName }, property, propertyUrl));
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("whatsapp_clicked", { propertyId: property.id })}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-whatsapp font-semibold text-whatsapp-foreground shadow-soft transition hover:brightness-95 active:translate-y-px",
        size === "lg" ? "h-12 px-5 text-[15px]" : "h-10 px-4 text-sm",
        className,
      )}
    >
      <WhatsAppIcon className={size === "lg" ? "size-5" : "size-4"} />
      {label}
    </a>
  );
}
