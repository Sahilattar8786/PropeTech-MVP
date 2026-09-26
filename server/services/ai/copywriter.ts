import { PROPERTY_TYPE_LABELS, RESIDENTIAL_TYPES } from "@/lib/domain/property";
import { formatArea, formatPrice } from "@/lib/format";
import { slugify } from "@/lib/slug";
import type { PropertyCopy, PropertyFacts } from "./types";

/**
 * Deterministic, fact-only copywriting. Used by the rules provider, as the
 * fallback whenever LLM copy fails validation, and for plans without AI enrichment.
 */

function configuration(facts: PropertyFacts): string {
  const type = PROPERTY_TYPE_LABELS[facts.propertyType ?? "other"];
  if (facts.propertyType === "building") return facts.floors ? `${facts.floors} ${type}` : type;
  if (facts.bedrooms && RESIDENTIAL_TYPES.includes(facts.propertyType ?? "apartment")) return `${facts.bedrooms} BHK ${type}`;
  return type;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "in Whitefield", or "near Bommanahalli" when the broker wrote "near" — never upgrade "near" to "in". */
function place(facts: PropertyFacts, sourceText = ""): string | null {
  const name = facts.location?.locality ?? facts.location?.city;
  if (!name) return null;
  const near = new RegExp(`\\bnear\\s+${escapeRegex(name)}`, "i").test(sourceText);
  return `${near ? "near" : "in"} ${name}`;
}

/** "3 BHK Apartment in Whitefield", "G+3 Independent Building near Bommanahalli" */
export function basicTitle(facts: PropertyFacts, sourceText?: string): string {
  const where = place(facts, sourceText);
  return `${configuration(facts)}${where ? ` ${where}` : ""}`;
}

/** Title with a descriptor grounded in the facts (furnishing or price tier). */
export function enrichedTitle(facts: PropertyFacts, sourceText?: string): string {
  let descriptor = "";
  if (facts.furnishing === "fully_furnished") descriptor = "Fully Furnished";
  else if (facts.listingType === "sale" && (facts.price?.amount ?? 0) >= 1_00_00_000) descriptor = "Premium";
  else if (facts.furnishing === "semi_furnished") descriptor = "Semi-Furnished";
  return [descriptor, basicTitle(facts, sourceText)].filter(Boolean).join(" ");
}

const endSentence = (text: string) => (text.endsWith(".") ? text : `${text}.`);

function article(word: string) {
  return /^[aeiou]/i.test(word) || /^(8|11|18)(\D|$)/.test(word) ? "An" : "A";
}

function listOf(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function templateDescription(facts: PropertyFacts, sourceText?: string): string {
  const sentences: string[] = [];
  const config = configuration(facts);
  const where = place(facts, sourceText);
  const loc = where && facts.location?.locality && facts.location.city ? `${where}, ${facts.location.city}` : where;
  const price = facts.price ? formatPrice(facts.price.amount, { perMonth: facts.listingType === "rent" }) : null;
  const offer = facts.listingType === "rent" ? "available for rent" : facts.listingType === "sale" ? "available for sale" : "available";

  const typeLabel = PROPERTY_TYPE_LABELS[facts.propertyType ?? "other"];
  const subject = config.replace(typeLabel, typeLabel.toLowerCase());
  sentences.push(`${article(subject)} ${subject}${loc ? ` ${loc}` : ""}, ${offer}${price ? ` at ${price}` : ""}.`);

  const details: string[] = [];
  const area = formatArea(facts.area);
  if (area) details.push(`spans ${area}`);
  if (facts.furnishing) details.push(`comes ${facts.furnishing === "unfurnished" ? "unfurnished" : facts.furnishing === "semi_furnished" ? "semi-furnished" : "fully furnished"}`);
  if (facts.parking) details.push(`includes ${facts.parking} parking ${facts.parking === 1 ? "space" : "spaces"}`);
  if (details.length) sentences.push(endSentence(`The property ${listOf(details)}`));
  if (facts.ageYears) sentences.push(`The ${facts.propertyType === "building" ? "building" : "property"} is ${facts.ageYears} ${facts.ageYears === 1 ? "year" : "years"} old.`);
  if (facts.bathrooms) sentences.push(`It has ${facts.bathrooms} ${facts.bathrooms === 1 ? "bathroom" : "bathrooms"}.`);
  if (facts.amenities.length) sentences.push(`Amenities include ${listOf(facts.amenities.map((a) => a.toLowerCase()))}.`);
  sentences.push("Message us on WhatsApp for more details or to schedule a site visit.");
  return sentences.join(" ");
}

export function templateHighlights(facts: PropertyFacts): string[] {
  const out: string[] = [];
  if (facts.floors) out.push(facts.floors);
  if (facts.bedrooms && RESIDENTIAL_TYPES.includes(facts.propertyType ?? "apartment")) out.push(`${facts.bedrooms} BHK`);
  const area = formatArea(facts.area);
  if (area) out.push(area);
  if (facts.furnishing) out.push(facts.furnishing === "semi_furnished" ? "Semi Furnished" : facts.furnishing === "fully_furnished" ? "Fully Furnished" : "Unfurnished");
  if (facts.parking) out.push(`${facts.parking} Parking`);
  if (facts.bathrooms) out.push(`${facts.bathrooms} Bathrooms`);
  if (facts.ageYears) out.push(`${facts.ageYears} ${facts.ageYears === 1 ? "year" : "years"} old`);
  if (facts.location?.locality) out.push(facts.location.locality);
  return [...out, ...facts.amenities.slice(0, 3)].slice(0, 8);
}

export function templateSeo(facts: PropertyFacts, title: string, description: string | null): NonNullable<PropertyCopy["seo"]> {
  const price = facts.price ? formatPrice(facts.price.amount, { perMonth: facts.listingType === "rent" }) : null;
  const metaTitle = price ? `${title} – ${price}` : title;
  const firstSentence = description?.split(/(?<=\.)\s/)[0] ?? title;
  return {
    metaTitle: metaTitle.slice(0, 90),
    metaDescription: firstSentence.slice(0, 160),
    slug: propertySlugBase(facts),
  };
}

/** "3bhk-whitefield", "4bhk-villa-sarjapur-road", "plot-devanahalli" */
export function propertySlugBase(facts: Pick<PropertyFacts, "bedrooms" | "propertyType" | "location">): string {
  const parts: string[] = [];
  const residential = RESIDENTIAL_TYPES.includes(facts.propertyType ?? "apartment");
  if (facts.bedrooms && residential) parts.push(`${facts.bedrooms}bhk`.replace(".", "-"));
  if (!facts.bedrooms || !residential || (facts.propertyType && !["apartment", "flat"].includes(facts.propertyType))) {
    parts.push(facts.propertyType && facts.propertyType !== "other" ? facts.propertyType : "property");
  }
  const where = facts.location?.locality ?? facts.location?.city;
  if (where) parts.push(where);
  return slugify(parts.join(" "), { maxLength: 60 }) || "property";
}

export function templateCopy(facts: PropertyFacts, opts: { enriched: boolean; sourceText?: string }): PropertyCopy {
  const title = opts.enriched ? enrichedTitle(facts, opts.sourceText) : basicTitle(facts, opts.sourceText);
  const description = opts.enriched ? templateDescription(facts, opts.sourceText) : null;
  return {
    title,
    description,
    highlights: templateHighlights(facts),
    seo: templateSeo(facts, title, description),
  };
}
