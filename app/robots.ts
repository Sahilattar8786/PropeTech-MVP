import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api", "/onboarding", "/login", "/register", "/forgot-password", "/reset-password"] }],
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
