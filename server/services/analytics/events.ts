export const ANALYTICS_EVENTS = [
  "landing_page_view",
  "signup_started",
  "signup_completed",
  "whatsapp_message_received",
  "property_ai_processing_started",
  "property_ai_processing_completed",
  "property_created",
  "property_published",
  "property_viewed",
  "whatsapp_clicked",
  "collection_viewed",
  "lead_created",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Events the browser may report through /api/track. Everything else is server-only. */
export const CLIENT_EVENTS = ["landing_page_view", "signup_started", "property_viewed", "whatsapp_clicked", "collection_viewed"] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];

export interface AnalyticsEventInput {
  name: AnalyticsEventName;
  tenantId?: string;
  propertyId?: string;
  collectionId?: string;
  userId?: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}
