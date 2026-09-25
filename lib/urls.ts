import { getAppProtocol, getAppUrl, getRootDomain } from "@/lib/config/site";

/**
 * Domain-mapping abstraction for public broker sites. Resolution order:
 *   1. verified custom domain    → https://www.rehanproperties.com
 *   2. broker subdomain          → https://rehanbrokers.propflow.in   (when NEXT_PUBLIC_ROOT_DOMAIN is set)
 *   3. path on the app domain    → https://propflow.in/rehanbrokers
 */
export interface BrokerUrlTarget {
  slug: string;
  customDomain?: string | null;
}

export function brokerBaseUrl(broker: BrokerUrlTarget): string {
  if (broker.customDomain) return `https://${broker.customDomain}`;
  const root = getRootDomain();
  if (root) return `${getAppProtocol()}://${broker.slug}.${root}`;
  return `${getAppUrl()}/${broker.slug}`;
}

export function propertyPublicUrl(broker: BrokerUrlTarget, propertySlug: string): string {
  return `${brokerBaseUrl(broker)}/property/${propertySlug}`;
}

export function collectionPublicUrl(broker: BrokerUrlTarget, collectionSlug: string): string {
  return `${brokerBaseUrl(broker)}/collections/${collectionSlug}`;
}

/** Host shown in the UI, e.g. "rehanbrokers.propflow.in". */
export function brokerDisplayHost(broker: BrokerUrlTarget): string {
  return brokerBaseUrl(broker).replace(/^https?:\/\//, "");
}

/** Canonical path-based URL — always served by this app regardless of DNS. */
export function brokerPathUrl(slug: string, path = ""): string {
  return `${getAppUrl()}/${slug}${path}`;
}

export function dashboardUrl(path = ""): string {
  return `${getAppUrl()}/dashboard${path}`;
}
