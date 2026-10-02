/**
 * Brand + public URL configuration.
 * Everything brand-related lives here so the product can be renamed in one place.
 */
export const siteConfig = {
  name: "PropFlow",
  tagline: "Turn WhatsApp Property Messages Into Professional Listings.",
  description:
    "Send property details and images on WhatsApp. PropFlow uses AI to organize them into beautiful, shareable property listings for your real-estate business.",
  secondaryTagline: "Your WhatsApp property inventory, organized and powered by AI.",
  supportEmail: "support@propflow.in",
  locale: "en_IN",
  /** Shown on /privacy and /terms — set to your registered company details before launch. */
  legal: {
    entityName: "PropFlow",
    address: "",
    jurisdiction: "India",
    lastUpdated: "26 September 2026",
  },
} as const;

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/** Absolute base URL of the app (marketing + dashboard). */
export function getAppUrl(): string {
  return trimSlash(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
}

/**
 * Root domain used for broker subdomains, e.g. `propflow.in` → `rehanbrokers.propflow.in`.
 * When unset, broker sites are served path-based: `{APP_URL}/{brokerSlug}`.
 * Only the host is used (port kept, e.g. `localhost:3000`), so a pasted `https://propflow.in/`
 * or `*.propflow.in` still works.
 */
export function getRootDomain(): string | null {
  const value = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^\*?\./, "")
    .replace(/[/?#].*$/, "");
  return value || null;
}

export function getAppProtocol(): "http" | "https" {
  return getAppUrl().startsWith("https") ? "https" : "http";
}
