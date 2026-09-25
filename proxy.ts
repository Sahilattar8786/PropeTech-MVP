import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Broker sites: `{slug}.{ROOT_DOMAIN}` and verified custom domains are rewritten
 *    to the path-based routes `/{slug}`, `/{slug}/property/*`, `/{slug}/collections/*`.
 * 2. Optimistic auth: requests to private areas without a session cookie go to /login.
 *    Real authorization happens server-side in layouts, actions and services.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const APP_HOST = new URL(APP_URL).host.toLowerCase();
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() || null;
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "dashboard", "mail", "sites", "static", "assets"]);
const PRIVATE_PREFIXES = ["/dashboard", "/onboarding", "/admin"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

const domainCache = new Map<string, { slug: string | null; expires: number }>();

function isAppHost(host: string) {
  const bare = host.replace(/:\d+$/, "");
  return host === APP_HOST || host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || bare === "localhost" || bare === "127.0.0.1";
}

async function resolveCustomDomain(host: string): Promise<string | null> {
  const cached = domainCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.slug;
  let slug: string | null = null;
  try {
    const res = await fetch(`${APP_URL}/api/domains/resolve?host=${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) slug = ((await res.json()) as { slug: string | null }).slug;
  } catch {
    slug = null;
  }
  domainCache.set(host, { slug, expires: Date.now() + 60_000 });
  return slug;
}

async function brokerSlugForHost(host: string): Promise<string | null> {
  if (isAppHost(host)) return null;
  if (ROOT_DOMAIN && host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    return !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub) ? sub : null;
  }
  return resolveCustomDomain(host.replace(/:\d+$/, ""));
}

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const { pathname, search } = request.nextUrl;

  const brokerSlug = await brokerSlugForHost(host);
  if (brokerSlug) {
    if (pathname === "/" || pathname.startsWith("/property/") || pathname.startsWith("/collections/")) {
      const target = `/${brokerSlug}${pathname === "/" ? "" : pathname}${search}`;
      return NextResponse.rewrite(new URL(target, request.url));
    }
    if (pathname !== "/opengraph-image" && !pathname.startsWith("/icon")) {
      return NextResponse.redirect(new URL(`${pathname}${search}`, APP_URL));
    }
    return NextResponse.next();
  }

  if (PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession) {
      const login = new URL("/login", request.url);
      login.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|media|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml)$).*)"],
};
