import type { Metadata } from "next";
import { TrackView } from "@/features/landing/track-view";
import { Hero } from "@/features/landing/hero";
import { SiteHeader } from "@/features/landing/site-header";
import {
  BrandedWebsiteSection,
  CollectionsSection,
  DashboardPreviewSection,
  FinalCta,
  HowItWorksSection,
  ListingPreviewSection,
  PricingSection,
  ProblemSection,
  SiteFooter,
  WhatsAppSection,
} from "@/features/landing/sections";
import { PLANS, PLAN_IDS } from "@/lib/config/plans";
import { getAppUrl, siteConfig } from "@/lib/config/site";

const title = `${siteConfig.name} — ${siteConfig.tagline}`;

export const metadata: Metadata = {
  title: { absolute: title },
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title,
    description: siteConfig.description,
    locale: siteConfig.locale,
  },
  twitter: { card: "summary_large_image", title, description: siteConfig.description },
  keywords: ["real estate broker software", "WhatsApp property listing", "property listing India", "broker website", "real estate CRM India"],
};

function StructuredData() {
  const url = getAppUrl();
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.name,
      url,
      logo: `${url}/icon.svg`,
      email: siteConfig.supportEmail,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: siteConfig.description,
      url,
      offers: PLAN_IDS.map((id) => ({
        "@type": "Offer",
        name: PLANS[id].name,
        price: PLANS[id].priceMonthly,
        priceCurrency: "INR",
      })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <TrackView event="landing_page_view" />
      <SiteHeader signedIn={false} />
      <main className="flex-1">
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <WhatsAppSection />
        <ListingPreviewSection />
        <DashboardPreviewSection />
        <BrandedWebsiteSection />
        <CollectionsSection />
        <PricingSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
