import { z } from "zod";
import { BROKER_SLUG_PATTERN, RESERVED_SLUGS } from "@/lib/slug";
import { whatsappNumberSchema } from "./auth";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const profileSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required").max(120),
  contactName: z.string().trim().min(2, "Your name is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(BROKER_SLUG_PATTERN, "Use 3–40 lowercase letters, numbers or hyphens")
    .refine((s) => !RESERVED_SLUGS.has(s), "That address is reserved"),
  tagline: optionalText(140),
  description: optionalText(2000),
  phone: optionalText(20),
  whatsappNumber: whatsappNumberSchema,
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(60),
  website: z.string().trim().url("Enter a full URL, e.g. https://example.com").optional().or(z.literal("")),
});
export type ProfileInput = z.infer<typeof profileSchema>;

const mediaUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || v.startsWith("/media/") || /^https:\/\//.test(v), "Upload an image")
  .optional();

export const brandingSchema = z.object({
  logoUrl: mediaUrl,
  profileImageUrl: mediaUrl,
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour"),
});
export type BrandingInput = z.infer<typeof brandingSchema>;

export const domainSchema = z.object({
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .pipe(z.string().regex(/^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/, "Enter a domain like www.rehanproperties.com")),
});
export type DomainInput = z.infer<typeof domainSchema>;
