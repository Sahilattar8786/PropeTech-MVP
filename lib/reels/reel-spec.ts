import { z } from "zod";
import type { PropertyDTO } from "@/lib/domain/property";
import { configurationLabel, formatArea, furnishingLabel, locationLabel, priceLabel } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

/**
 * Instagram Reel for a property: a title slide on the cover photo, one slide per photo
 * with an editable title, and a WhatsApp call-to-action. Safe on client and server.
 */
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_FPS = 30;
export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const MAX_REEL_SLIDES = 20;
export const OUTRO_SECONDS = 3;

export const reelDraftSchema = z.object({
  intro: z.object({
    image: z.string().min(1, "Pick a cover photo"),
    title: z.string().trim().min(1, "Add a title").max(90),
    subtitle: z.string().trim().max(100),
  }),
  slides: z.array(z.object({ image: z.string().min(1), title: z.string().trim().max(70) })).max(MAX_REEL_SLIDES),
  outro: z.object({ title: z.string().trim().max(70), subtitle: z.string().trim().max(90) }),
  caption: z.string().max(INSTAGRAM_CAPTION_LIMIT, `Instagram captions are limited to ${INSTAGRAM_CAPTION_LIMIT} characters`),
  secondsPerSlide: z.number().min(1.5).max(6),
});
export type ReelDraft = z.infer<typeof reelDraftSchema>;

type ReelProperty = Pick<PropertyDTO, "title" | "images" | "price" | "listingType" | "location" | "propertyType" | "bedrooms" | "area" | "furnishing" | "parking" | "amenities" | "description">;
type ReelBroker = { businessName: string; whatsappNumber: string };

export type ReelSegment = { kind: "intro" | "slide" | "outro"; index: number; start: number; duration: number };

/** Sequential segments: title slide, photo slides, closing slide. Times in seconds. */
export function reelTimeline(draft: Pick<ReelDraft, "slides" | "secondsPerSlide">): ReelSegment[] {
  const segments: ReelSegment[] = [];
  let start = 0;
  const push = (kind: ReelSegment["kind"], index: number, duration: number) => {
    segments.push({ kind, index, start, duration });
    start += duration;
  };
  push("intro", 0, Math.max(3, draft.secondsPerSlide));
  draft.slides.forEach((_, i) => push("slide", i, draft.secondsPerSlide));
  push("outro", 0, OUTRO_SECONDS);
  return segments;
}

export function reelDurationSeconds(draft: Pick<ReelDraft, "slides" | "secondsPerSlide">): number {
  const last = reelTimeline(draft).at(-1)!;
  return last.start + last.duration;
}

/** Slide titles built only from the property's own facts — never invented. */
export function factSlideTitles(p: ReelProperty): string[] {
  const titles: string[] = [];
  const area = formatArea(p.area);
  titles.push([configurationLabel(p), area].filter(Boolean).join(" · "));
  if (p.price) titles.push(priceLabel(p));
  const comfort = [furnishingLabel(p.furnishing), p.parking ? `${p.parking} Parking` : null].filter(Boolean).join(" · ");
  if (comfort) titles.push(comfort);
  const where = locationLabel(p.location);
  if (where) titles.push(where);
  for (let i = 0; i < p.amenities.length; i += 2) titles.push(p.amenities.slice(i, i + 2).join(" · "));
  return titles.filter((t) => t.trim().length > 0);
}

function hashtag(value: string): string | null {
  const tag = value.replace(/&/g, "and").replace(/[^A-Za-z0-9]+/g, "");
  return tag.length >= 3 ? `#${tag}` : null;
}

export function buildCaption(p: ReelProperty, broker: ReelBroker, publicUrl?: string): string {
  const lines: string[] = [p.title, ""];
  const where = locationLabel(p.location);
  if (where) lines.push(`📍 ${where}`);
  if (p.price) lines.push(`💰 ${priceLabel(p)}`);
  const specs = [configurationLabel(p), formatArea(p.area)].filter(Boolean).join(" · ");
  if (specs) lines.push(`🏠 ${specs}`);
  const comfort = [furnishingLabel(p.furnishing), p.parking ? `${p.parking} Parking` : null].filter(Boolean).join(" · ");
  if (comfort) lines.push(`✨ ${comfort}`);
  if (p.description) lines.push("", p.description.length > 600 ? `${p.description.slice(0, 597).trimEnd()}…` : p.description);
  lines.push("", `📲 WhatsApp ${formatPhone(broker.whatsappNumber)} to enquire or book a site visit.`);
  if (publicUrl) lines.push(`🔗 ${publicUrl}`);

  const tags = [
    p.location?.locality && hashtag(`${p.location.locality}`),
    p.location?.city && hashtag(`${p.location.city}RealEstate`),
    p.location?.city && hashtag(`${p.location.city}Properties`),
    p.bedrooms && hashtag(`${p.bedrooms}BHK`),
    hashtag(p.listingType === "rent" ? "PropertyForRent" : "PropertyForSale"),
    hashtag("RealEstateIndia"),
    hashtag(broker.businessName),
  ].filter((t): t is string => Boolean(t));
  lines.push("", [...new Set(tags)].join(" "));
  return lines.join("\n").slice(0, INSTAGRAM_CAPTION_LIMIT);
}

export function buildDefaultReel(p: ReelProperty, broker: ReelBroker, publicUrl?: string): ReelDraft {
  const [cover = "", ...rest] = p.images;
  const titles = factSlideTitles(p);
  return {
    intro: {
      image: cover,
      title: p.title,
      subtitle: [p.price ? priceLabel(p) : null, locationLabel(p.location, { short: true })].filter(Boolean).join(" · "),
    },
    slides: rest.slice(0, MAX_REEL_SLIDES).map((image, i) => ({ image, title: titles[i] ?? "" })),
    outro: { title: "Interested? Message us on WhatsApp", subtitle: `${broker.businessName} · ${formatPhone(broker.whatsappNumber)}` },
    caption: buildCaption(p, broker, publicUrl),
    secondsPerSlide: 2.5,
  };
}

/** A saved reel, adjusted to the property's current photos (photos may have been removed since). */
export function restoreReel(saved: ReelDraft | undefined, images: string[], defaults: ReelDraft): ReelDraft {
  if (!saved) return defaults;
  const available = new Set(images);
  return {
    ...saved,
    intro: { ...saved.intro, image: available.has(saved.intro.image) ? saved.intro.image : defaults.intro.image },
    slides: saved.slides.filter((slide) => available.has(slide.image)),
  };
}
