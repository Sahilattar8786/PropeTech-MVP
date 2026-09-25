import { z } from "zod";
import { AREA_UNITS, FURNISHING_TYPES, LISTING_TYPES, PROPERTY_TYPES } from "@/lib/domain/property";
import { AppError } from "@/server/lib/errors";
import {
  FACT_KEYS,
  EMPTY_FACTS,
  propertyCopySchema,
  propertyFactsSchema,
  type AIProvider,
  type FactKey,
  type PropertyAIInput,
  type PropertyAIOutput,
} from "./types";

/**
 * OpenAI (or any OpenAI-compatible endpoint) using Chat Completions with strict
 * JSON-schema structured output. Responses are re-validated with Zod and then
 * grounded against the source text by PropertyValidationService.
 */

const str = { type: ["string", "null"] };
const num = { type: ["number", "null"] };

const FACTS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...Object.keys(propertyFactsSchema.shape), "fieldConfidence"],
  properties: {
    isProperty: { type: "boolean" },
    propertyType: { type: ["string", "null"], enum: [...PROPERTY_TYPES, null] },
    listingType: { type: ["string", "null"], enum: [...LISTING_TYPES, null] },
    bedrooms: num,
    bathrooms: { type: ["integer", "null"] },
    location: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["address", "locality", "city", "state", "pincode"],
          properties: { address: str, locality: str, city: str, state: str, pincode: str },
        },
        { type: "null" },
      ],
    },
    area: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["value", "unit"],
          properties: { value: { type: "number" }, unit: { type: "string", enum: [...AREA_UNITS] } },
        },
        { type: "null" },
      ],
    },
    price: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["amount", "currency"],
          properties: { amount: { type: "number" }, currency: { type: "string", enum: ["INR"] } },
        },
        { type: "null" },
      ],
    },
    furnishing: { type: ["string", "null"], enum: [...FURNISHING_TYPES, null] },
    parking: { type: ["integer", "null"] },
    amenities: { type: "array", items: { type: "string" } },
    fieldConfidence: {
      type: "object",
      additionalProperties: false,
      required: [...FACT_KEYS],
      properties: Object.fromEntries(FACT_KEYS.map((k) => [k, num])),
    },
  },
} as const;

const COPY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "highlights", "seo"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    seo: {
      type: "object",
      additionalProperties: false,
      required: ["metaTitle", "metaDescription", "slug"],
      properties: { metaTitle: { type: "string" }, metaDescription: { type: "string" }, slug: { type: "string" } },
    },
  },
} as const;

const EXTRACTION_PROMPT = `You extract structured facts from Indian real-estate broker messages (often WhatsApp shorthand).

STRICT RULES — never invent facts:
- Only output a value if it is explicitly stated in the message. Otherwise output null (or [] for amenities).
- Never guess price, area, location, amenities, parking, floor, ownership, RERA, legal or possession status, builder or project name.
- Prices: convert Indian units to rupees (1 Cr = 10000000, 1 Lakh/L/Lac = 100000, 1k = 1000). Ignore deposits, maintenance and per-sqft rates.
- listingType: "rent" if rent/lease/per month wording is present; "sale" if sale wording is present or the price is in lakhs/crores without rent wording; otherwise null.
- propertyType: flat/apartment → "apartment". If only BHK is given with no type word, use "apartment".
- Area: use sqft or sqm as written. Convert sq.yards (×9) and acres (×43560) to sqft.
- Location: locality exactly as written (proper case). City/state only if written, or if the locality unambiguously belongs to one well-known Indian city. Never use a city just because it is common.
- amenities: only amenities literally mentioned, as short labels (e.g. "Swimming Pool", "Gym").
- isProperty: false if the message is not describing a property (e.g. greetings, questions).
- fieldConfidence: your confidence 0–1 for each extracted field, null for fields you left null.`;

const ENRICHMENT_PROMPT = `You write listing copy for an Indian real-estate broker from VERIFIED FACTS (JSON).

STRICT RULES:
- Use ONLY the facts provided. Do not add amenities, views, floor, facing, nearby landmarks, connectivity, RERA, possession, ownership, legal, builder or project claims.
- Do not state any number that is not in the facts.
- title: concise, e.g. "Premium 3 BHK Apartment in Whitefield" (≤ 70 chars). "Premium" is allowed only for sale prices ≥ ₹1 Cr.
- description: 60–120 words, professional and warm, plain text, ending with an invitation to enquire on WhatsApp.
- highlights: up to 6 short chips built from the facts (e.g. "3 BHK", "1,800 sq.ft.", "Semi Furnished", "2 Parking").
- seo.metaTitle ≤ 60 chars, seo.metaDescription ≤ 155 chars, seo.slug lowercase-hyphenated like "3bhk-whitefield".
- Write prices in Indian style: ₹1.50 Cr, ₹85 L, ₹45,000/month.`;

const factsResponseSchema = propertyFactsSchema.extend({
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1).nullable()),
});

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async extractProperty(input: PropertyAIInput): Promise<PropertyAIOutput> {
    const context = input.context?.brokerCity ? `\n\nBroker's home city (use ONLY to disambiguate a locality name that exists in several cities): ${input.context.brokerCity}` : "";
    const raw = await this.complete(EXTRACTION_PROMPT, `Broker message:\n"""\n${input.text}\n"""${context}`, "property_facts", FACTS_JSON_SCHEMA);
    const parsed = factsResponseSchema.parse(raw);
    const { fieldConfidence, ...facts } = parsed;
    const confidence: Partial<Record<FactKey, number>> = {};
    for (const key of FACT_KEYS) {
      const value = fieldConfidence[key];
      if (typeof value === "number") confidence[key] = value;
    }
    return { facts, copy: null, fieldConfidence: confidence, provider: this.name };
  }

  async enrichProperty(input: PropertyAIInput): Promise<PropertyAIOutput> {
    const facts = input.facts ?? EMPTY_FACTS;
    const raw = await this.complete(ENRICHMENT_PROMPT, `VERIFIED FACTS:\n${JSON.stringify(facts, null, 2)}`, "property_copy", COPY_JSON_SCHEMA);
    const copy = propertyCopySchema.parse(raw);
    return { facts, copy, fieldConfidence: {}, provider: this.name };
  }

  private async complete(system: string, user: string, schemaName: string, schema: object): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      throw new AppError("INTEGRATION", `AI request failed: ${error instanceof Error ? error.message : "network error"}`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AppError("INTEGRATION", `AI request failed (${res.status}) ${detail.slice(0, 200)}`);
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
    const message = body.choices?.[0]?.message;
    if (!message?.content) throw new AppError("INTEGRATION", message?.refusal ?? "AI returned an empty response");
    return JSON.parse(message.content);
  }
}
