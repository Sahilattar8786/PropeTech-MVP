/**
 * Deterministic parsers for Indian real-estate shorthand
 * ("3bhk flat in whitefield 1800 sqft 1.5 cr"). Pure functions — no I/O.
 * Every value returned here is literally present in the source text.
 */
import type { AreaUnit, Furnishing, ListingType, PropertyType } from "@/lib/domain/property";

export interface PriceMatch {
  amount: number;
  raw: string;
  unit: "cr" | "lakh" | "k" | "plain";
}

const PRICE_UNITS: Record<string, { multiplier: number; unit: PriceMatch["unit"] }> = {
  cr: { multiplier: 1e7, unit: "cr" },
  crs: { multiplier: 1e7, unit: "cr" },
  crore: { multiplier: 1e7, unit: "cr" },
  crores: { multiplier: 1e7, unit: "cr" },
  l: { multiplier: 1e5, unit: "lakh" },
  lac: { multiplier: 1e5, unit: "lakh" },
  lacs: { multiplier: 1e5, unit: "lakh" },
  lakh: { multiplier: 1e5, unit: "lakh" },
  lakhs: { multiplier: 1e5, unit: "lakh" },
  lk: { multiplier: 1e5, unit: "lakh" },
  k: { multiplier: 1e3, unit: "k" },
  thousand: { multiplier: 1e3, unit: "k" },
};

const NON_PRICE_CONTEXT = /(deposit|advance|maintenance|maint\.?|token|brokerage|registration|stamp|per\s*sq|\/\s*sq|psf)\s*[:\-]?\s*$/i;

/** Returns every rupee amount in the text, skipping deposits, maintenance and per-sqft rates. */
export function findPrices(text: string): PriceMatch[] {
  const results: PriceMatch[] = [];
  const pattern = /(₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(crores?|crs?|lakhs?|lacs?|lac|lk|l|k|thousand)?(?![a-z])/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const [raw, currency, numberPart, unitPart] = m;
    const before = text.slice(Math.max(0, m.index - 20), m.index);
    const after = text.slice(m.index + raw.length, m.index + raw.length + 12);
    if (NON_PRICE_CONTEXT.test(before)) continue;
    if (/^\s*(\/|per)\s*(sq|sft|square)/i.test(after)) continue;
    if (/^\s*(sq|sft|square|bhk|bed|br\b|bath|park|car|floor|acre|cent|gaj|yard|min|km)/i.test(after)) continue;
    const value = Number(numberPart.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    const unitKey = unitPart?.toLowerCase();
    if (unitKey && PRICE_UNITS[unitKey]) {
      const { multiplier, unit } = PRICE_UNITS[unitKey];
      results.push({ amount: Math.round(value * multiplier), raw: raw.trim(), unit });
    } else if (currency && value >= 1000) {
      results.push({ amount: Math.round(value), raw: raw.trim(), unit: "plain" });
    }
  }
  return results;
}

const RENT_PATTERN = /\b(rent|rental|lease|to[\s-]?let|per\s*month|\/\s*month|\/\s*mo|p\.?\s?m\.?|monthly)\b/i;
const SALE_PATTERN = /\b(sale|sell|selling|resale|for\s*sale|outright|ownership)\b/i;

export function detectListingType(text: string, price?: number | null): { value: ListingType; confidence: number } | null {
  if (RENT_PATTERN.test(text)) return { value: "rent", confidence: 0.95 };
  if (SALE_PATTERN.test(text)) return { value: "sale", confidence: 0.95 };
  // A price in lakhs/crores without rent wording is a sale price in Indian listings.
  if (price && price >= 10_00_000) return { value: "sale", confidence: 0.8 };
  return null;
}

export function pickPrice(text: string, listingType: ListingType | null): PriceMatch | null {
  const prices = findPrices(text);
  if (prices.length === 0) return null;
  if (listingType === "rent") return prices.find((p) => p.unit === "k" || p.unit === "plain") ?? prices[0];
  return prices.find((p) => p.unit === "cr" || p.unit === "lakh") ?? prices[0];
}

export interface AreaMatch {
  value: number;
  unit: AreaUnit;
  raw: string;
}

const AREA_UNIT_PATTERN =
  /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(sq\.?\s*ft\.?|sqft|sft|sq\.?\s*feet|square\s*feet|ft2|sq\.?\s*m(?:t|tr|eters?|etres?)?\.?|sqm|square\s*met(?:er|re)s?|sq\.?\s*y(?:ar)?ds?\.?|square\s*yards?|gaj|acres?|guntas?|cents?)(?![a-z])/i;

export function findArea(text: string): AreaMatch | null {
  const m = AREA_UNIT_PATTERN.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  const unit = m[2].toLowerCase().replace(/\s+/g, "");
  if (!Number.isFinite(value) || value <= 0) return null;
  if (/^(sq\.?m|sqm|squaremet)/.test(unit)) return { value, unit: "sqm", raw: m[0] };
  if (/^(sq\.?y|squareyard|gaj)/.test(unit)) return { value: Math.round(value * 9), unit: "sqft", raw: m[0] };
  if (/^acre/.test(unit)) return { value: Math.round(value * 43560), unit: "sqft", raw: m[0] };
  if (/^gunta/.test(unit)) return { value: Math.round(value * 1089), unit: "sqft", raw: m[0] };
  if (/^cent/.test(unit)) return { value: Math.round(value * 435.6), unit: "sqft", raw: m[0] };
  return { value, unit: "sqft", raw: m[0] };
}

export function findBedrooms(text: string): number | null {
  const m = /(\d+(?:\.5)?)\s*-?\s*(?:bhk|b\.h\.k|bed(?:room)?s?|br)\b/i.exec(text);
  if (!m) return null;
  const value = Number(m[1]);
  return value > 0 && value <= 20 ? value : null;
}

export function findBathrooms(text: string): number | null {
  const m = /(\d+)\s*-?\s*(?:bath(?:room)?s?|toilets?|washrooms?)\b/i.exec(text);
  return m ? Number(m[1]) : null;
}

export function findParking(text: string): number | null {
  const m =
    /(\d+)\s*(?:nos?\.?\s*)?(?:covered\s*|open\s*|car\s*)?(?:parkings?|car\s*parks?|car\s*spaces?)\b/i.exec(text) ??
    /\bparkings?\s*[:\-]?\s*(\d+)\b/i.exec(text);
  if (!m) return null;
  const value = Number(m[1]);
  return value >= 0 && value <= 50 ? value : null;
}

export function findFurnishing(text: string): Furnishing | null {
  if (/\bsemi[\s-]*furnished\b/i.test(text)) return "semi_furnished";
  if (/\b(un[\s-]*furnished|bare[\s-]*shell|non[\s-]*furnished)\b/i.test(text)) return "unfurnished";
  if (/\b(fully[\s-]*furnished|full[\s-]*furnished|furnished)\b/i.test(text)) return "fully_furnished";
  return null;
}

const TYPE_KEYWORDS: [RegExp, PropertyType][] = [
  [/\bvillas?\b/i, "villa"],
  [/\bbungalows?\b/i, "bungalow"],
  [/\b(independent\s*house|row\s*house|individual\s*house|(?<!club\s?)house)\b/i, "house"],
  [/\b(plots?|land|site(?!\s*visit))\b/i, "plot"],
  [/\b(office\s*space|offices?|co-?working)\b/i, "office"],
  [/\b(shops?|showrooms?|retail\s*space)\b/i, "shop"],
  [/\b(warehouses?|godowns?)\b/i, "warehouse"],
  [/\bflats?\b/i, "apartment"],
  [/\b(apartments?|apt|condo)\b/i, "apartment"],
  [/\b(commercial\s*space|commercial)\b/i, "commercial"],
];

export function findPropertyType(text: string): { value: PropertyType; confidence: number } | null {
  let best: { value: PropertyType; index: number } | null = null;
  for (const [pattern, value] of TYPE_KEYWORDS) {
    const m = pattern.exec(text);
    if (m && (!best || m.index < best.index)) best = { value, index: m.index };
  }
  if (best) return { value: best.value, confidence: 0.95 };
  // "3 BHK in Whitefield" without a type word is almost always an apartment.
  if (findBedrooms(text)) return { value: "apartment", confidence: 0.7 };
  return null;
}

/** Amenity vocabulary: canonical label → phrases that must literally appear in the text. */
export const AMENITY_KEYWORDS: Record<string, RegExp> = {
  "Swimming Pool": /\b(swimming\s*pool|pool)\b/i,
  Gym: /\b(gym|gymnasium|fitness\s*cent(er|re))\b/i,
  Clubhouse: /\b(club\s*house|clubhouse)\b/i,
  Lift: /\b(lifts?|elevators?)\b/i,
  "Power Backup": /\b(power\s*back\s*-?up|dg\s*back\s*-?up|generator)\b/i,
  "24x7 Security": /\b(24\s*[x*\/]\s*7\s*security|security(?!\s*deposit))\b/i,
  "Gated Community": /\bgated\s*(community|society)?\b/i,
  "Children's Play Area": /\b(play\s*area|kids?\s*play|children'?s?\s*play)\b/i,
  Garden: /\b(garden|landscaped)\b/i,
  "Jogging Track": /\bjogging\s*track\b/i,
  CCTV: /\bcctv\b/i,
  Intercom: /\bintercom\b/i,
  "Rainwater Harvesting": /\brain\s*water\s*harvesting\b/i,
  "Piped Gas": /\b(piped\s*gas|gas\s*pipeline|png)\b/i,
  "Modular Kitchen": /\bmodular\s*kitchen\b/i,
  Balcony: /\bbalcon(y|ies)\b/i,
  "Visitor Parking": /\bvisitor'?s?\s*parking\b/i,
  "Tennis Court": /\btennis\b/i,
  "Badminton Court": /\bbadminton\b/i,
  "Indoor Games": /\bindoor\s*games\b/i,
  "Water Supply 24x7": /\b24\s*[x*\/]\s*7\s*water\b/i,
  "Servant Room": /\b(servant|maid)'?s?\s*room\b/i,
  "Private Terrace": /\b(private\s*)?terrace\b/i,
};

export function findAmenities(text: string): string[] {
  return Object.entries(AMENITY_KEYWORDS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

export function findPincode(text: string): string | null {
  const m = /\b(?:pin(?:\s*code)?|pincode|zip)\s*[:\-]?\s*([1-9]\d{5})\b/i.exec(text);
  return m ? m[1] : null;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** All numbers mentioned in text, including number words — used for grounding checks. */
export function numbersInText(text: string): number[] {
  const values = [...text.matchAll(/\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, "")));
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) values.push(value);
  }
  return values.filter(Number.isFinite);
}
