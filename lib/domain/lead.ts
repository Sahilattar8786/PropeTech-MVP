/** Shared lead constants — safe for server and client components. */
export const LEAD_STATUS_VALUES = ["new", "contacted", "qualified", "closed"] as const;
export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatusValue, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  closed: "Closed",
};

export const LEAD_SOURCE_LABELS = {
  property_page: "Property page",
  broker_page: "Broker website",
  collection_page: "Collection",
  whatsapp: "WhatsApp",
} as const;
