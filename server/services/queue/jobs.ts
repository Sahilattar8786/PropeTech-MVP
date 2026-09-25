import type { AnalyticsEventInput } from "@/server/services/analytics/events";

export const QUEUE_NAMES = [
  "whatsapp-message-processing",
  "whatsapp-media-processing",
  "property-ai-processing",
  "property-image-processing",
  "analytics-processing",
] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export interface JobPayloads {
  /** Groups a burst of WhatsApp messages from one conversation into a property draft. */
  "whatsapp-message-processing": { tenantId: string; conversationId: string };
  /** Downloads a WhatsApp media item and stores the original in object storage. */
  "whatsapp-media-processing": { tenantId: string; messageId: string; propertyId: string };
  /** Runs AI extraction → validation → enrichment on a property draft. */
  "property-ai-processing": { tenantId: string; propertyId: string; notifyBroker?: boolean };
  /** Optimises a stored original and attaches it to a property. */
  "property-image-processing": { tenantId: string; mediaId: string; propertyId: string };
  "analytics-processing": { event: AnalyticsEventInput };
}

export interface EnqueueOptions {
  delayMs?: number;
  /** Jobs sharing an id are de-duplicated while pending. */
  jobId?: string;
  attempts?: number;
}

export interface JobMeta {
  attempt: number;
  maxAttempts: number;
}

export type Processor<Q extends QueueName> = (payload: JobPayloads[Q], meta: JobMeta) => Promise<void>;

export const DEFAULT_ATTEMPTS: Record<QueueName, number> = {
  "whatsapp-message-processing": 3,
  "whatsapp-media-processing": 4,
  "property-ai-processing": 3,
  "property-image-processing": 3,
  "analytics-processing": 2,
};
