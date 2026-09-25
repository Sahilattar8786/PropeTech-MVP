import { connectDB } from "@/server/db/connect";
import { logger } from "@/server/lib/logger";
import { AnalyticsEvent } from "@/server/models";
import { enqueue } from "@/server/services/queue/queue";
import type { AnalyticsEventInput, AnalyticsEventName } from "./events";

/**
 * Provider-agnostic analytics. `trackEvent` never throws and never blocks the caller:
 * events go through the analytics queue and are fanned out to every registered sink.
 */
export interface AnalyticsSink {
  name: string;
  write(event: AnalyticsEventInput): Promise<void>;
}

const mongoSink: AnalyticsSink = {
  name: "mongo",
  async write(event) {
    await connectDB();
    await AnalyticsEvent.create({
      name: event.name,
      tenantId: event.tenantId,
      propertyId: event.propertyId,
      collectionId: event.collectionId,
      userId: event.userId,
      properties: event.properties,
      createdAt: event.timestamp ? new Date(event.timestamp) : new Date(),
    });
  },
};

const consoleSink: AnalyticsSink = {
  name: "console",
  async write(event) {
    logger.debug(`analytics: ${event.name}`, { tenantId: event.tenantId, propertyId: event.propertyId });
  },
};

// Add PostHog / Mixpanel / GA sinks here without touching callers.
const sinks: AnalyticsSink[] = [mongoSink, consoleSink];

export function trackEvent(
  name: AnalyticsEventName,
  properties: Omit<AnalyticsEventInput, "name" | "timestamp"> = {},
): void {
  const event: AnalyticsEventInput = { name, ...properties, timestamp: new Date().toISOString() };
  enqueue("analytics-processing", { event }).catch((error) => logger.warn("trackEvent enqueue failed", error));
}

/** Queue processor: writes an event to all sinks. */
export async function deliverAnalyticsEvent(event: AnalyticsEventInput): Promise<void> {
  const results = await Promise.allSettled(sinks.map((sink) => sink.write(event)));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === sinks.length) throw (failed[0] as PromiseRejectedResult).reason;
}
