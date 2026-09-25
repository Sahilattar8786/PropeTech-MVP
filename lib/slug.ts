/** Slug helpers shared by broker, property and collection URLs. */

export function slugify(input: string, opts: { separator?: string; maxLength?: number } = {}): string {
  const separator = opts.separator ?? "-";
  const maxLength = opts.maxLength ?? 60;
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}+`, "g"), separator)
    .replace(new RegExp(`^\\${separator}|\\${separator}$`, "g"), "");
  return slug.slice(0, maxLength).replace(new RegExp(`\\${separator}$`), "");
}

/** Broker slugs double as subdomains: lowercase letters, digits and single hyphens. */
export const BROKER_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Paths and subdomains that can never be claimed by a broker. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "blog",
  "collections",
  "dashboard",
  "docs",
  "help",
  "login",
  "logout",
  "mail",
  "media",
  "onboarding",
  "pricing",
  "property",
  "register",
  "robots.txt",
  "settings",
  "signup",
  "sitemap.xml",
  "static",
  "status",
  "support",
  "www",
  "_next",
]);

export function brokerSlugFromName(name: string): string {
  // "Rehan Brokers" → "rehanbrokers": compact slugs read better as subdomains.
  const compact = slugify(name, { separator: "-", maxLength: 40 }).replace(/-/g, "");
  return compact.length >= 3 ? compact.slice(0, 30) : `${compact || "broker"}${Math.floor(Math.random() * 900 + 100)}`;
}

export function isValidBrokerSlug(slug: string): boolean {
  return BROKER_SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}
