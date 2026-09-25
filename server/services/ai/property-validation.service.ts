import { citiesForLocality, findCity } from "./gazetteer";
import { AMENITY_KEYWORDS, numbersInText } from "./parsing";
import type { FactKey, PropertyCopy, PropertyFacts } from "./types";

/**
 * Step 2 — the AI safety net. Every fact returned by a provider must be traceable
 * to the broker's own words; anything that isn't is removed (set to null) and
 * reported as a warning so the broker can fill it in.
 */

export interface GroundingResult {
  facts: PropertyFacts;
  warnings: string[];
  removed: FactKey[];
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function approxIn(values: number[], target: number, tolerance = 0.01) {
  return values.some((v) => Math.abs(v - target) <= Math.max(tolerance * target, 0.001));
}

function priceIsGrounded(amount: number, text: string, numbers: number[]): boolean {
  // Accept the amount in any unit the broker could have written it in.
  const candidates = [amount, amount / 1e7, amount / 1e5, amount / 1e3];
  return candidates.some((c) => approxIn(numbers, c)) || text.replace(/,/g, "").includes(String(amount));
}

function areaIsGrounded(value: number, numbers: number[]): boolean {
  // Allow unit conversions the extractor is permitted to make (sq.yd, acre, sqm↔sqft).
  return [1, 9, 43560, 1089, 435.6, 10.7639, 1 / 10.7639].some((factor) => approxIn(numbers, value / factor, 0.02));
}

function amenityIsGrounded(amenity: string, text: string): boolean {
  const known = AMENITY_KEYWORDS[amenity];
  if (known) return known.test(text);
  const haystack = normalize(text);
  const generic = new Set(["area", "and", "the", "with", "facility", "facilities", "room", "space", "system", "24x7", "24", "7"]);
  const words = normalize(amenity).split(" ").filter((w) => w.length >= 3 && !generic.has(w));
  return words.length > 0 && words.some((w) => haystack.includes(w.replace(/s$/, "")));
}

function textIncludes(text: string, needle: string): boolean {
  const n = normalize(needle).replace(/\s+/g, "");
  return n.length > 0 && normalize(text).replace(/\s+/g, "").includes(n);
}

export function groundFacts(facts: PropertyFacts, sourceText: string): GroundingResult {
  const text = sourceText ?? "";
  const numbers = numbersInText(text);
  const out: PropertyFacts = structuredClone(facts);
  const warnings: string[] = [];
  const removed: FactKey[] = [];
  const drop = (key: FactKey, message: string) => {
    removed.push(key);
    warnings.push(message);
  };

  if (out.price && !priceIsGrounded(out.price.amount, text, numbers)) {
    out.price = null;
    drop("price", "Price was not found in the message — please add it.");
  }
  if (out.area && !areaIsGrounded(out.area.value, numbers)) {
    out.area = null;
    drop("area", "Area was not found in the message — please add it.");
  }
  if (out.bedrooms !== null && !approxIn(numbers, out.bedrooms)) {
    out.bedrooms = null;
    drop("bedrooms", "BHK was not found in the message.");
  }
  if (out.bathrooms !== null && !approxIn(numbers, out.bathrooms)) {
    out.bathrooms = null;
    drop("bathrooms", "Bathrooms were not found in the message.");
  }
  if (out.parking !== null && !(/park/i.test(text) && approxIn(numbers, out.parking))) {
    out.parking = null;
    drop("parking", "Parking was not found in the message.");
  }
  if (out.furnishing && !/furnish|bare\s*shell/i.test(text)) {
    out.furnishing = null;
    drop("furnishing", "Furnishing status was not found in the message.");
  }
  const amenities = out.amenities.filter((a) => amenityIsGrounded(a, text));
  if (amenities.length !== out.amenities.length) {
    const unsupported = out.amenities.filter((a) => !amenities.includes(a));
    warnings.push(`Removed amenities not mentioned in the message: ${unsupported.join(", ")}.`);
    removed.push("amenities");
  }
  out.amenities = [...new Set(amenities)];

  if (out.location) {
    const loc = { ...out.location };
    if (loc.locality && !textIncludes(text, loc.locality)) loc.locality = null;
    if (loc.address && !textIncludes(text, loc.address)) loc.address = null;
    if (loc.pincode && !text.includes(loc.pincode)) loc.pincode = null;
    if (loc.city) {
      const stated = findCity(text)?.city === loc.city || textIncludes(text, loc.city);
      const implied = loc.locality ? citiesForLocality(loc.locality).some((c) => c.city === loc.city) : false;
      if (!stated && !implied) {
        loc.city = null;
        loc.state = null;
        warnings.push("City could not be confirmed from the message — please add it.");
      }
    }
    if (loc.state && !loc.city) loc.state = null;
    const changed = JSON.stringify(loc) !== JSON.stringify(out.location);
    if (changed && !loc.locality && facts.location?.locality) drop("location", "Location was not found in the message — please add it.");
    out.location = loc.locality || loc.city || loc.address || loc.pincode ? loc : null;
  }

  return { facts: out, warnings, removed };
}

/** Claims the copy may only make if the broker's text supports them. */
const GUARDED_CLAIMS: [RegExp, RegExp][] = [
  [/\brera\b/i, /\brera\b/i],
  [/possession|ready[\s-]to[\s-]move|under[\s-]construction|new[\s-]launch/i, /possession|ready|construction|launch/i],
  [/freehold|leasehold|clear title|legal|approved|khata|\boc\b|occupancy certificate/i, /freehold|leasehold|title|legal|approved|khata|\boc\b|occupancy/i],
  [/\bfloor\b/i, /\bfloor\b/i],
  [/\bfacing\b|vastu/i, /facing|vastu/i],
  [/builder|developer|\bproject\b/i, /builder|developer|project/i],
  [/metro|airport|school|hospital|mall|tech\s*park|it\s*park|highway/i, /metro|airport|school|hospital|mall|tech\s*park|it\s*park|highway/i],
  [/\bview\b|sea[\s-]facing|lake/i, /view|sea|lake/i],
];

/** Numbers the copy is allowed to mention: the facts, in every format we render them. */
function allowedNumbers(facts: PropertyFacts): number[] {
  const allowed = [0, 1, 7, 24];
  if (facts.price) allowed.push(facts.price.amount, facts.price.amount / 1e7, facts.price.amount / 1e5, facts.price.amount / 1e3);
  if (facts.area) allowed.push(facts.area.value);
  for (const n of [facts.bedrooms, facts.bathrooms, facts.parking]) if (n !== null) allowed.push(n);
  if (facts.location?.pincode) allowed.push(Number(facts.location.pincode));
  return allowed;
}

/** Rejects LLM copy that mentions unsupported numbers or guarded claims. */
export function validateCopy(copy: PropertyCopy, facts: PropertyFacts, sourceText: string): { ok: boolean; reason?: string } {
  const body = [copy.title, copy.description ?? "", ...copy.highlights].join(" \n ");
  const allowed = allowedNumbers(facts);
  for (const n of numbersInText(body)) {
    if (!approxIn(allowed, n, 0.02)) return { ok: false, reason: `Copy mentions unsupported number ${n}` };
  }
  for (const [claim, support] of GUARDED_CLAIMS) {
    if (claim.test(body) && !support.test(sourceText)) return { ok: false, reason: `Copy makes an unsupported claim (${claim.source})` };
  }
  const factAmenities = new Set(facts.amenities.map((a) => a.toLowerCase()));
  for (const [label, pattern] of Object.entries(AMENITY_KEYWORDS)) {
    if (pattern.test(body) && !factAmenities.has(label.toLowerCase()) && !pattern.test(sourceText)) {
      return { ok: false, reason: `Copy mentions amenity "${label}" that the broker did not` };
    }
  }
  return { ok: true };
}
