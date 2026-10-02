import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRootDomain } from "@/lib/config/site";
import { brokerBaseUrl, propertyPublicUrl } from "@/lib/urls";

async function loadProxy() {
  vi.resetModules();
  return (await import("@/proxy")).proxy;
}

const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite");

describe("broker subdomains", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the root domain as a hostname even when a URL was pasted", () => {
    for (const value of ["prop.sahilproject.ink", "https://prop.sahilproject.ink", "https://prop.sahilproject.ink/", "*.prop.sahilproject.ink", " PROP.sahilproject.ink "]) {
      vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", value);
      expect(getRootDomain()).toBe("prop.sahilproject.ink");
    }
    // Local testing keeps the port: http://<slug>.localhost:3000
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "http://localhost:3000/");
    expect(getRootDomain()).toBe("localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "");
    expect(getRootDomain()).toBeNull();
  });

  it("builds subdomain links for brokers", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prop.sahilproject.ink/");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "https://prop.sahilproject.ink");
    expect(brokerBaseUrl({ slug: "markestates" })).toBe("https://markestates.prop.sahilproject.ink");
    expect(propertyPublicUrl({ slug: "markestates" }, "3bhk-baner")).toBe("https://markestates.prop.sahilproject.ink/property/3bhk-baner");
    expect(brokerBaseUrl({ slug: "markestates", customDomain: "www.markestates.com" })).toBe("https://www.markestates.com");
  });

  it("serves the broker site at the root of their subdomain", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prop.sahilproject.ink/");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "https://prop.sahilproject.ink");
    const proxy = await loadProxy();
    const at = (url: string) => proxy(new NextRequest(url, { headers: { host: new URL(url).host } }));

    expect(rewriteOf(await at("https://markestates.prop.sahilproject.ink/"))).toBe("https://markestates.prop.sahilproject.ink/markestates");
    expect(rewriteOf(await at("https://markestates.prop.sahilproject.ink/property/3bhk-baner?ref=wa"))).toBe(
      "https://markestates.prop.sahilproject.ink/markestates/property/3bhk-baner?ref=wa",
    );
    expect(rewriteOf(await at("https://markestates.prop.sahilproject.ink/collections/baner"))).toBe("https://markestates.prop.sahilproject.ink/markestates/collections/baner");

    // Path-style links on the broker's own subdomain stay on the broker site.
    const redirectOf = async (url: string) => (await at(url)).headers.get("location");
    expect(await redirectOf("https://markestates.prop.sahilproject.ink/markestates")).toBe("https://markestates.prop.sahilproject.ink/");
    expect(await redirectOf("https://markestates.prop.sahilproject.ink/markestates/")).toBe("https://markestates.prop.sahilproject.ink/");
    expect(await redirectOf("https://markestates.prop.sahilproject.ink/markestates/property/3bhk-baner?ref=wa")).toBe(
      "https://markestates.prop.sahilproject.ink/property/3bhk-baner?ref=wa",
    );

    // Dashboard and other app paths go back to the main site.
    const dashboard = await at("https://markestates.prop.sahilproject.ink/dashboard");
    expect(dashboard.headers.get("location")).toBe("https://prop.sahilproject.ink/dashboard");

    // The main site and reserved subdomains are untouched.
    expect(rewriteOf(await at("https://prop.sahilproject.ink/"))).toBeNull();
    expect(rewriteOf(await at("https://www.prop.sahilproject.ink/"))).toBeNull();
  });
});
