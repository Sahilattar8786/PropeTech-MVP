import { templateCopy } from "./copywriter";
import { canonicalCity, findCity, findLocality } from "./gazetteer";
import {
  detectListingType,
  findAmenities,
  findArea,
  findBathrooms,
  findBedrooms,
  findFurnishing,
  findParking,
  findPincode,
  findPrices,
  findPropertyType,
  pickPrice,
} from "./parsing";
import { EMPTY_FACTS, type AIProvider, type FactKey, type PropertyAIInput, type PropertyAIOutput, type PropertyFacts } from "./types";

/**
 * Deterministic provider — works offline with no API key. It only returns values
 * that literally appear in the text, which makes it a safe default and a useful
 * baseline for grounding LLM output.
 */
export class RulesProvider implements AIProvider {
  readonly name = "rules";

  async extractProperty(input: PropertyAIInput): Promise<PropertyAIOutput> {
    const text = input.text ?? "";
    const confidence: Partial<Record<FactKey, number>> = {};

    const type = findPropertyType(text);
    const firstPrice = findPrices(text)[0]?.amount ?? null;
    const listing = detectListingType(text, firstPrice);
    const price = pickPrice(text, listing?.value ?? null);
    const area = findArea(text);
    const bedrooms = findBedrooms(text);
    const bathrooms = findBathrooms(text);
    const parking = findParking(text);
    const furnishing = findFurnishing(text);
    const amenities = findAmenities(text);
    const location = this.location(text, input.context?.brokerCity);

    if (type) confidence.propertyType = type.confidence;
    if (listing) confidence.listingType = listing.confidence;
    if (price) confidence.price = 0.96;
    if (area) confidence.area = 0.97;
    if (bedrooms) confidence.bedrooms = 0.98;
    if (bathrooms) confidence.bathrooms = 0.95;
    if (parking !== null) confidence.parking = 0.94;
    if (furnishing) confidence.furnishing = 0.95;
    if (amenities.length) confidence.amenities = 0.9;
    if (location) confidence.location = location.confidence;

    const facts: PropertyFacts = {
      ...EMPTY_FACTS,
      propertyType: type?.value ?? null,
      listingType: listing?.value ?? null,
      bedrooms,
      bathrooms,
      parking,
      furnishing,
      amenities,
      area: area ? { value: area.value, unit: area.unit } : null,
      price: price ? { amount: price.amount, currency: "INR" } : null,
      location: location?.value ?? null,
    };
    facts.isProperty = Boolean(facts.propertyType || facts.price || facts.area || facts.bedrooms || facts.location?.locality);

    return { facts, copy: null, fieldConfidence: confidence, provider: this.name };
  }

  async enrichProperty(input: PropertyAIInput): Promise<PropertyAIOutput> {
    const facts = input.facts ?? EMPTY_FACTS;
    return { facts, copy: templateCopy(facts, { enriched: true }), fieldConfidence: {}, provider: this.name };
  }

  private location(text: string, brokerCity?: string) {
    const locality = findLocality(text);
    const statedCity = findCity(text);
    const pincode = findPincode(text);
    let city: { city: string; state: string } | null = statedCity;
    let confidence = 0.95;

    if (!city && locality) {
      if (locality.cities.length === 1) city = locality.cities[0]!;
      else if (locality.cities.length > 1 && brokerCity) {
        // Ambiguous locality name: only resolve it if one candidate is the broker's own city.
        const home = canonicalCity(brokerCity);
        city = locality.cities.find((c) => c.city === home?.city) ?? null;
        confidence = 0.85;
      }
    }
    if (!locality && !city && !pincode) return null;
    return {
      value: {
        address: null,
        locality: locality?.locality ?? null,
        city: city?.city ?? null,
        state: city?.state ?? null,
        pincode,
      },
      confidence: locality ? confidence : 0.8,
    };
  }
}
