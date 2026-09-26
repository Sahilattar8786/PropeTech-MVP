import { describe, expect, it } from "vitest";
import { buildDefaultReel, factSlideTitles, INSTAGRAM_CAPTION_LIMIT, reelDraftSchema, reelDurationSeconds, reelTimeline, restoreReel } from "@/lib/reels/reel-spec";

const broker = { businessName: "Rehan Properties", whatsappNumber: "919876543210" };
const property = {
  title: "Premium 3 BHK Apartment in Whitefield",
  images: ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg", "https://cdn.test/3.jpg", "https://cdn.test/4.jpg"],
  price: { amount: 15000000, currency: "INR" as const },
  listingType: "sale" as const,
  location: { locality: "Whitefield", city: "Bangalore" },
  propertyType: "apartment" as const,
  bedrooms: 3,
  area: { value: 1800, unit: "sqft" as const },
  furnishing: "semi_furnished" as const,
  parking: 2,
  amenities: [],
  description: "A 3 BHK apartment in Whitefield, Bangalore.",
};

describe("Instagram Reel defaults", () => {
  it("puts the title on the cover photo and one slide per remaining photo", () => {
    const reel = buildDefaultReel(property, broker, "https://rehan.propflow.in/property/3bhk-whitefield");
    expect(reel.intro).toEqual({ image: property.images[0], title: property.title, subtitle: "₹1.50 Cr · Whitefield" });
    expect(reel.slides.map((s) => s.image)).toEqual(property.images.slice(1));
    expect(reelDraftSchema.safeParse(reel).success).toBe(true);
  });

  it("builds slide titles only from facts the property has", () => {
    expect(factSlideTitles(property)).toEqual(["3 BHK Apartment · 1,800 sq.ft.", "₹1.50 Cr", "Semi Furnished · 2 Parking", "Whitefield, Bangalore"]);
    const sparse = { ...property, price: undefined, area: undefined, furnishing: undefined, parking: undefined, location: undefined };
    expect(factSlideTitles(sparse)).toEqual(["3 BHK Apartment"]);
    // More photos than facts: the extra slides get no text rather than invented text.
    const reel = buildDefaultReel({ ...sparse, images: property.images }, broker);
    expect(reel.slides.map((s) => s.title)).toEqual(["3 BHK Apartment", "", ""]);
  });

  it("writes a caption with the facts, contact, link and hashtags within Instagram's limit", () => {
    const { caption } = buildDefaultReel(property, broker, "https://rehan.propflow.in/property/3bhk-whitefield");
    expect(caption).toContain("📍 Whitefield, Bangalore");
    expect(caption).toContain("💰 ₹1.50 Cr");
    expect(caption).toContain("+91 98765 43210");
    expect(caption).toContain("https://rehan.propflow.in/property/3bhk-whitefield");
    expect(caption).toMatch(/#Whitefield #BangaloreRealEstate .*#3BHK .*#RehanProperties/);
    const long = buildDefaultReel({ ...property, description: "x ".repeat(3000) }, broker);
    expect(long.caption.length).toBeLessThanOrEqual(INSTAGRAM_CAPTION_LIMIT);
  });
});

describe("Instagram Reel timeline", () => {
  it("runs title slide, photo slides, then the WhatsApp slide", () => {
    const segments = reelTimeline({ slides: [{ image: "a", title: "" }, { image: "b", title: "" }], secondsPerSlide: 2.5 });
    expect(segments.map((s) => [s.kind, s.start, s.duration])).toEqual([
      ["intro", 0, 3],
      ["slide", 3, 2.5],
      ["slide", 5.5, 2.5],
      ["outro", 8, 3],
    ]);
    expect(reelDurationSeconds({ slides: [], secondsPerSlide: 4 })).toBe(7);
  });

  it("drops saved slides whose photo was removed from the property", () => {
    const defaults = buildDefaultReel(property, broker);
    const saved = { ...defaults, intro: { ...defaults.intro, image: "https://cdn.test/deleted.jpg" }, slides: [{ image: "https://cdn.test/deleted.jpg", title: "Gone" }, { image: property.images[2]!, title: "Kitchen" }] };
    const restored = restoreReel(saved, property.images, defaults);
    expect(restored.intro.image).toBe(property.images[0]);
    expect(restored.slides).toEqual([{ image: property.images[2], title: "Kitchen" }]);
    expect(restoreReel(undefined, property.images, defaults)).toBe(defaults);
  });
});
