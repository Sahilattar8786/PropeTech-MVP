import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp, RATE_LIMITS } from "@/server/lib/rate-limit";
import { CLIENT_EVENTS } from "@/server/services/analytics/events";
import { trackEvent } from "@/server/services/analytics/track";
import { incrementCollectionViews } from "@/server/services/collections/collection.service";
import { recordPropertyView, recordWhatsAppClick, visitorHash } from "@/server/services/leads/lead.service";

const bodySchema = z.object({
  event: z.enum(CLIENT_EVENTS),
  propertyId: z.string().max(40).optional(),
  collectionId: z.string().max(40).optional(),
  url: z.string().max(1000).optional(),
});

/** Beacon endpoint for browser analytics. Always answers 204 quickly; work runs after the response. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  if (!checkRateLimit(`track:${ip}`, RATE_LIMITS.track).ok) return new Response(null, { status: 429 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(JSON.parse(await request.text()));
  } catch {
    return new Response(null, { status: 400 });
  }
  const visitor = visitorHash(ip, request.headers.get("user-agent") ?? "");

  after(async () => {
    switch (body.event) {
      case "property_viewed":
        // One counted view per visitor per property per 30 minutes.
        if (body.propertyId && checkRateLimit(`view:${visitor}:${body.propertyId}`, { limit: 1, windowMs: 30 * 60_000 }).ok) {
          await recordPropertyView(body.propertyId);
        }
        break;
      case "whatsapp_clicked":
        if (body.propertyId) await recordWhatsAppClick({ propertyId: body.propertyId, sourceUrl: body.url, visitor });
        break;
      case "collection_viewed":
        if (body.collectionId && checkRateLimit(`cview:${visitor}:${body.collectionId}`, { limit: 1, windowMs: 30 * 60_000 }).ok) {
          const tenantId = await incrementCollectionViews(body.collectionId);
          if (tenantId) trackEvent("collection_viewed", { tenantId, collectionId: body.collectionId });
        }
        break;
      default:
        trackEvent(body.event, { properties: { url: body.url } });
    }
  });
  return new Response(null, { status: 204 });
}
