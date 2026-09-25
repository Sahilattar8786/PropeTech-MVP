import { RESIDENTIAL_TYPES } from "@/lib/domain/property";
import { extractPropertyFacts } from "./property-extraction.service";
import { enrichProperty } from "./property-enrichment.service";
import { groundFacts } from "./property-validation.service";
import type { FactKey, PropertyAIInput, PropertyCopy, PropertyFacts } from "./types";

/**
 * PropertyAIService — Raw WhatsApp data → Extraction → Validation → Enrichment → Structured property.
 */
export interface PropertyAIResult {
  isProperty: boolean;
  facts: PropertyFacts;
  copy: PropertyCopy;
  /** Per-field provenance for everything the AI filled in. */
  fieldConfidence: Partial<Record<FactKey | "title" | "description" | "highlights" | "seo", number>>;
  generatedFields: string[];
  /** Overall 0–1 score shown to the broker as "AI confidence". */
  confidenceScore: number;
  warnings: string[];
  provider: string;
}

const KEY_FIELDS: FactKey[] = ["propertyType", "location", "price", "area", "listingType"];

export function scoreConfidence(facts: PropertyFacts, fieldConfidence: Partial<Record<FactKey, number>>): number {
  const expected = [...KEY_FIELDS];
  if (facts.propertyType && RESIDENTIAL_TYPES.includes(facts.propertyType)) expected.push("bedrooms");
  const present = expected.filter((k) => {
    const v = facts[k];
    return v !== null && v !== undefined;
  });
  if (present.length === 0) return 0;
  const mean = present.reduce((sum, k) => sum + (fieldConfidence[k] ?? 0.75), 0) / present.length;
  const coverage = present.length / expected.length;
  return Math.round(mean * Math.sqrt(coverage) * 100) / 100;
}

function isPresent(facts: PropertyFacts, key: FactKey) {
  const v = facts[key];
  return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined;
}

export async function runPropertyAIPipeline(input: PropertyAIInput, opts: { enrichment: boolean }): Promise<PropertyAIResult> {
  const extracted = await extractPropertyFacts(input);
  const grounded = groundFacts(extracted.facts, input.text);
  const facts = grounded.facts;
  const enrichment = await enrichProperty(facts, input.text, { enabled: opts.enrichment });

  const fieldConfidence: PropertyAIResult["fieldConfidence"] = {};
  const generatedFields: string[] = [];
  for (const key of Object.keys(extracted.fieldConfidence) as FactKey[]) {
    if (isPresent(facts, key)) {
      fieldConfidence[key] = extracted.fieldConfidence[key];
      generatedFields.push(key);
    }
  }
  const copyConfidence = enrichment.generator === "llm" ? 0.9 : 0.95;
  fieldConfidence.title = copyConfidence;
  generatedFields.push("title");
  if (enrichment.copy.description) {
    fieldConfidence.description = copyConfidence;
    generatedFields.push("description");
  }
  if (enrichment.copy.highlights.length) {
    fieldConfidence.highlights = copyConfidence;
    generatedFields.push("highlights");
  }
  if (enrichment.copy.seo) {
    fieldConfidence.seo = copyConfidence;
    generatedFields.push("seo");
  }

  const hasSignal = facts.propertyType || facts.price || facts.area || facts.bedrooms || facts.location;
  return {
    isProperty: Boolean(extracted.facts.isProperty && hasSignal),
    facts,
    copy: enrichment.copy,
    fieldConfidence,
    generatedFields,
    confidenceScore: scoreConfidence(facts, extracted.fieldConfidence),
    warnings: [...grounded.warnings, ...enrichment.warnings],
    provider: extracted.provider,
  };
}
