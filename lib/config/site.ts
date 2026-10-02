/**
 * Brand + public URL configuration.
 * Everything brand-related lives here so the product can be renamed in one place.
 */
export const siteConfig = {
  name: "Propsora",
  /** Marketing domain, used in copy and examples. Live URLs always come from the environment. */
  domain: "propsora.com",
  tagline: "Launch your property website in minutes.",
  positioning: "Shopify for real estate",
  description:
    "Send property details and photos on WhatsApp. Propsora's AI turns them into professional listings on your own branded website, ready to share, with enquiries straight to your WhatsApp.",
  secondaryTagline: "Shopify for real estate. Your property website, live in minutes.",
  supportEmail: "support@propsora.com",
  locale: "en_IN",
  /** Shown on /privacy and /terms — set to your registered company details before launch. */
  legal: {
    entityName: "Propsora",
    address: "",
    jurisdiction: "India",
    lastUpdated: "2 October 2026",
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
 * Root domain used for broker subdomains, e.g. `propsora.com` → `rehanbrokers.propsora.com`.
 * When unset, broker sites are served path-based: `{APP_URL}/{brokerSlug}`.
 * Only the host is used (port kept, e.g. `localhost:3000`), so a pasted `https://propsora.com/`
 * or `*.propsora.com` still works.
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

export type DeploymentStage = "production" | "staging" | "development";

/**
 * Which deployment this is (server-side only). Production is the `main` branch on propsora.com;
 * staging is the `staging` branch on prop.sahilproject.ink. `APP_ENV` wins when set; otherwise
 * Vercel preview deployments count as staging, so they are never indexed by search engines.
 */
export function getDeploymentStage(): DeploymentStage {
  const explicit = process.env.APP_ENV?.trim();
  if (explicit === "production" || explicit === "staging" || explicit === "development") return explicit;
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "staging";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}
