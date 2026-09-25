import { afterEach, describe, expect, it } from "vitest";
import { runPropertyAIPipeline } from "@/server/services/ai/property-ai.service";
import { groundFacts, validateCopy } from "@/server/services/ai/property-validation.service";
import { setAIProvider } from "@/server/services/ai/provider";
import { RulesProvider } from "@/server/services/ai/rules.provider";
import { EMPTY_FACTS, type AIProvider, type PropertyFacts } from "@/server/services/ai/types";
import { findArea, findPrices } from "@/server/services/ai/parsing";

afterEach(() => setAIProvider(null));

describe("rules extraction (spec §15 example)", () => {
  it("extracts the canonical WhatsApp message", async () => {
    setAIProvider(new RulesProvider());
    const result = await runPropertyAIPipeline({ text: "3bhk flat in whitefield 1800 sqft 1.5 cr", images: [] }, { enrichment: true });
    expect(result.isProperty).toBe(true);
    expect(result.facts).toMatchObject({
      propertyType: "apartment",
      listingType: "sale",
      bedrooms: 3,
      location: { locality: "Whitefield", city: "Bangalore", state: "Karnataka" },
      area: { value: 1800, unit: "sqft" },
      price: { amount: 15000000, currency: "INR" },
    });
    expect(result.copy.title).toBe("Premium 3 BHK Apartment in Whitefield");
    expect(result.confidenceScore).toBeGreaterThan(0.85);
  });

  it("handles a multi-line broker message", async () => {
    setAIProvider(new RulesProvider());
    const text = "New Property\n3 BHK Apartment\nWhitefield\n1800 sqft\n₹1.5 Cr\nSemi Furnished\n2 Parking";
    const { facts } = await runPropertyAIPipeline({ text, images: [] }, { enrichment: true });
    expect(facts.furnishing).toBe("semi_furnished");
    expect(facts.parking).toBe(2);
    expect(facts.price?.amount).toBe(15000000);
  });

  it("recognises rentals and ignores deposits", async () => {
    setAIProvider(new RulesProvider());
    const { facts } = await runPropertyAIPipeline({ text: "2bhk for rent in HSR Layout 45k per month, deposit 2L, 1100 sqft", images: [] }, { enrichment: true });
    expect(facts.listingType).toBe("rent");
    expect(facts.price?.amount).toBe(45000);
    expect(facts.location?.city).toBe("Bangalore");
  });

  it("never invents amenities, parking or furnishing", async () => {
    setAIProvider(new RulesProvider());
    const { facts, copy } = await runPropertyAIPipeline({ text: "3bhk flat in whitefield 1800 sqft 1.5 cr", images: [] }, { enrichment: true });
    expect(facts.amenities).toEqual([]);
    expect(facts.parking).toBeNull();
    expect(facts.furnishing).toBeNull();
    expect(copy.description).not.toMatch(/parking|furnished|gym|pool/i);
  });

  it("flags non-property chatter", async () => {
    setAIProvider(new RulesProvider());
    const result = await runPropertyAIPipeline({ text: "thanks, will call you tomorrow", images: [] }, { enrichment: true });
    expect(result.isProperty).toBe(false);
  });

  it("does not treat area or BHK numbers as prices", () => {
    expect(findPrices("3bhk 1800 sqft 2 parking")).toEqual([]);
    expect(findPrices("₹8,500 per sqft")).toEqual([]);
    expect(findArea("200 sq yards plot")?.value).toBe(1800);
  });
});

describe("grounding (AI safety rule)", () => {
  const source = "3bhk flat in whitefield 1800 sqft 1.5 cr";

  it("removes facts that are not in the broker's text", () => {
    const hallucinated: PropertyFacts = {
      ...EMPTY_FACTS,
      isProperty: true,
      propertyType: "apartment",
      bedrooms: 3,
      price: { amount: 17500000, currency: "INR" },
      area: { value: 1800, unit: "sqft" },
      parking: 2,
      furnishing: "fully_furnished",
      amenities: ["Swimming Pool", "Gym"],
      location: { address: null, locality: "Whitefield", city: "Bangalore", state: "Karnataka", pincode: "560066" },
    };
    const { facts, removed } = groundFacts(hallucinated, source);
    expect(facts.price).toBeNull();
    expect(facts.parking).toBeNull();
    expect(facts.furnishing).toBeNull();
    expect(facts.amenities).toEqual([]);
    expect(facts.location?.pincode).toBeNull();
    expect(facts.location?.city).toBe("Bangalore"); // implied unambiguously by the locality
    expect(facts.area?.value).toBe(1800);
    expect(removed).toEqual(expect.arrayContaining(["price", "parking", "furnishing", "amenities"]));
  });

  it("rejects copy with unsupported claims or numbers", () => {
    const facts: PropertyFacts = { ...EMPTY_FACTS, isProperty: true, bedrooms: 3, price: { amount: 15000000, currency: "INR" }, area: { value: 1800, unit: "sqft" } };
    const base = { title: "Premium 3 BHK Apartment in Whitefield", highlights: ["3 BHK", "1,800 sq.ft."], seo: null };
    expect(validateCopy({ ...base, description: "A 3 BHK home of 1,800 sq.ft. at ₹1.50 Cr." }, facts, source).ok).toBe(true);
    expect(validateCopy({ ...base, description: "RERA approved and ready to move." }, facts, source).ok).toBe(false);
    expect(validateCopy({ ...base, description: "Located on the 12th floor." }, facts, source).ok).toBe(false);
    expect(validateCopy({ ...base, description: "Enjoy the swimming pool." }, facts, source).ok).toBe(false);
  });

  it("falls back to template copy when an LLM invents details", async () => {
    const lyingProvider: AIProvider = {
      name: "fake-llm",
      extractProperty: (input) => new RulesProvider().extractProperty(input),
      enrichProperty: async (input) => ({
        facts: input.facts!,
        copy: { title: "Luxury 3 BHK", description: "RERA approved, 5 minutes from the metro.", highlights: [], seo: null },
        fieldConfidence: {},
        provider: "fake-llm",
      }),
    };
    setAIProvider(lyingProvider);
    const result = await runPropertyAIPipeline({ text: source, images: [] }, { enrichment: true });
    expect(result.copy.description).not.toMatch(/RERA|metro/);
    expect(result.warnings.join(" ")).toMatch(/unverified/);
  });
});
