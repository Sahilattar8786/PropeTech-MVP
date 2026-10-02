import type { MetadataRoute } from "next";
import { getAppUrl, getDeploymentStage } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
  if (getDeploymentStage() === "staging") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api", "/onboarding", "/login", "/register", "/forgot-password", "/reset-password"] }],
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
