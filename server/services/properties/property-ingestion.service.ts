import type { FieldSource } from "@/lib/domain/property";
import { connectDB } from "@/server/db/connect";
import { logger } from "@/server/lib/logger";
import { Broker, Property, type IProperty } from "@/server/models";
import { runPropertyAIPipeline, type PropertyAIResult } from "@/server/services/ai/property-ai.service";
import { trackEvent } from "@/server/services/analytics/track";
import { getEntitlements } from "@/server/services/subscriptions/subscription.service";
import type { HydratedDocument } from "mongoose";

export const AI_FAILURE_MESSAGE = "We couldn't automatically process this property.";
export const NOT_A_PROPERTY_MESSAGE = "We couldn't find property details in this message.";

/** Writes a pipeline result onto a draft. Never touches fields the broker has already edited. */
export function applyAIResult(doc: HydratedDocument<IProperty>, result: PropertyAIResult) {
  const brokerOwned = new Set(
    [...(doc.fieldSources?.entries() ?? [])].filter(([, s]) => (s as FieldSource).source === "broker").map(([k]) => k),
  );
  const set = <K extends keyof IProperty>(key: K, field: string, value: IProperty[K] | null | undefined) => {
    if (brokerOwned.has(field)) return;
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) return;
    doc.set(key, value);
  };
  const { facts, copy } = result;

  set("propertyType", "propertyType", facts.propertyType ?? undefined);
  set("listingType", "listingType", facts.listingType ?? undefined);
  set("bedrooms", "bedrooms", facts.bedrooms);
  set("bathrooms", "bathrooms", facts.bathrooms);
  set("parking", "parking", facts.parking);
  set("furnishing", "furnishing", facts.furnishing ?? undefined);
  set("price", "price", facts.price ?? undefined);
  set("area", "area", facts.area ?? undefined);
  if (facts.location) {
    const clean = Object.fromEntries(Object.entries(facts.location).filter(([, v]) => v !== null));
    set("location", "location", clean as IProperty["location"]);
  }
  set("amenities", "amenities", facts.amenities);
  set("title", "title", copy.title);
  set("description", "description", copy.description ?? undefined);
  set("highlights", "highlights", copy.highlights);
  if (copy.seo) set("seo", "seo", { metaTitle: copy.seo.metaTitle, metaDescription: copy.seo.metaDescription });

  const sources = doc.fieldSources ?? new Map<string, FieldSource>();
  for (const [field, confidence] of Object.entries(result.fieldConfidence)) {
    if (!brokerOwned.has(field) && typeof confidence === "number") sources.set(field, { source: "ai", confidence });
  }
  doc.fieldSources = sources;
  doc.aiMetadata = {
    generatedFields: result.generatedFields.filter((f) => !brokerOwned.has(f)),
    confidenceScore: result.confidenceScore,
    provider: result.provider,
    warnings: result.warnings,
  };
}

/**
 * Runs the AI pipeline for a draft and persists the outcome.
 * On the final failed attempt the draft is kept with ingestion.stage = "failed"
 * so the broker can "Review Manually" or "Retry AI Processing".
 */
export async function processPropertyWithAI(
  tenantId: string,
  propertyId: string,
  opts: { finalAttempt: boolean } = { finalAttempt: true },
): Promise<{ ok: boolean; doc: HydratedDocument<IProperty> | null }> {
  await connectDB();
  const doc = await Property.findOne({ _id: propertyId, tenantId });
  if (!doc) return { ok: false, doc: null };
  const text = doc.ingestion?.rawText ?? "";

  doc.set("ingestion.stage", "ai_processing");
  doc.set("ingestion.attempts", (doc.ingestion?.attempts ?? 0) + 1);
  doc.set("ingestion.updatedAt", new Date());
  doc.set("ingestion.error", undefined);
  await doc.save();
  trackEvent("property_ai_processing_started", { tenantId, propertyId });

  try {
    const [entitlements, broker] = await Promise.all([
      getEntitlements(tenantId),
      Broker.findOne({ tenantId }).select("city").lean<{ city?: string }>(),
    ]);
    if (!text.trim()) throw new Error(NOT_A_PROPERTY_MESSAGE);
    const result = await runPropertyAIPipeline(
      { text, images: doc.images, context: { brokerCity: broker?.city } },
      { enrichment: entitlements.aiEnrichment },
    );
    if (!result.isProperty) {
      doc.set("ingestion.stage", "failed");
      doc.set("ingestion.error", NOT_A_PROPERTY_MESSAGE);
      await doc.save();
      return { ok: false, doc };
    }
    applyAIResult(doc, result);
    doc.set("ingestion.stage", "completed");
    doc.set("ingestion.updatedAt", new Date());
    await doc.save();
    trackEvent("property_ai_processing_completed", {
      tenantId,
      propertyId,
      properties: { confidence: result.confidenceScore, provider: result.provider },
    });
    return { ok: true, doc };
  } catch (error) {
    logger.warn(`AI processing failed for property ${propertyId}`, error);
    if (!opts.finalAttempt) {
      doc.set("ingestion.stage", "processing");
      await doc.save();
      throw error;
    }
    doc.set("ingestion.stage", "failed");
    doc.set("ingestion.error", AI_FAILURE_MESSAGE);
    await doc.save();
    return { ok: false, doc };
  }
}
