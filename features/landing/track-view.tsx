"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics-client";
import type { ClientEventName } from "@/server/services/analytics/events";

/** Fires a single analytics event when mounted (page views). */
export function TrackView({ event, propertyId, collectionId }: { event: ClientEventName; propertyId?: string; collectionId?: string }) {
  useEffect(() => {
    track(event, { propertyId, collectionId });
  }, [event, propertyId, collectionId]);
  return null;
}
