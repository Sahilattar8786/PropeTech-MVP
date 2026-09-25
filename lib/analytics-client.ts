"use client";

import type { ClientEventName } from "@/server/services/analytics/events";

/**
 * Browser-side tracking. Uses sendBeacon so it never blocks navigation
 * (e.g. when a customer is leaving for WhatsApp). Vendor-agnostic: the server fans out.
 */
export function track(event: ClientEventName, properties: { propertyId?: string; collectionId?: string; [key: string]: unknown } = {}) {
  try {
    const body = JSON.stringify({ event, ...properties, url: window.location.href });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/track", blob)) return;
    void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // Tracking must never break the page.
  }
}
