import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, MapPin, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyIllustration } from "@/components/shared/property-illustration";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { BrokerAvatar } from "@/features/public-site/broker-chrome";
import { PublicPropertyCard } from "@/features/public-site/public-property-card";
import { brokerFirstName } from "@/lib/domain/broker";
import { brokerBaseUrl, collectionPublicUrl, propertyPublicUrl } from "@/lib/urls";
import { buildWhatsAppUrl } from "@/lib/whatsapp-link";
import { listPublicCollections } from "@/server/services/collections/collection.service";
import { listPublicProperties } from "@/server/services/properties/public-property.service";
import { getPublicBrokerBySlug } from "@/server/services/tenants/broker.service";

export async function generateMetadata({ params }: PageProps<"/[brokerSlug]">): Promise<Metadata> {
  const { brokerSlug } = await params;
  const broker = await getPublicBrokerBySlug(brokerSlug);
  if (!broker) return { title: "Not found" };
  const title = `${broker.businessName}${broker.city ? ` — Properties in ${broker.city}` : ""}`;
  const description = broker.description?.slice(0, 160) ?? `${broker.tagline ?? "Residential & commercial properties"} by ${broker.businessName}${broker.city ? `, ${broker.city}` : ""}. Enquire on WhatsApp.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: brokerBaseUrl(broker) },
    openGraph: { type: "website", title, description, url: brokerBaseUrl(broker), images: broker.logoUrl ? [{ url: broker.logoUrl }] : undefined },
    twitter: { card: "summary", title, description },
  };
}

export default async function BrokerHomePage({ params, searchParams }: PageProps<"/[brokerSlug]">) {
  const { brokerSlug } = await params;
  const { q } = await searchParams;
  const broker = await getPublicBrokerBySlug(brokerSlug);
  if (!broker) notFound();
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const [properties, collections] = await Promise.all([listPublicProperties(broker.tenantId, { q: query || undefined }), listPublicCollections(broker.tenantId)]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: broker.businessName,
    url: brokerBaseUrl(broker),
    telephone: `+${broker.whatsappNumber}`,
    ...(broker.email ? { email: broker.email } : {}),
    ...(broker.city ? { address: { "@type": "PostalAddress", addressLocality: broker.city, addressCountry: "IN" } } : {}),
    ...(broker.logoUrl ? { logo: broker.logoUrl } : {}),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="border-b bg-[linear-gradient(180deg,var(--brand-soft),transparent)]">
        <div className="container-page py-10 sm:py-14">
          <div className="flex items-center gap-4">
            <BrokerAvatar broker={broker} size={64} />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">{broker.businessName}</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {broker.tagline ?? "Residential & Commercial Properties"}
                {broker.city && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {broker.city}
                  </span>
                )}
              </p>
            </div>
          </div>
          <form className="mt-8 flex max-w-xl gap-2" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={query} placeholder="Search by locality, BHK or property ID" aria-label="Search properties" className="h-12 rounded-xl bg-background pl-10 text-[15px]" />
            </div>
            <Button type="submit" className="h-12 rounded-xl bg-brand px-5 text-brand-foreground hover:bg-brand/90">
              Search
            </Button>
          </form>
        </div>
      </section>

      <section id="properties" className="container-page scroll-mt-20 py-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{query ? `Results for “${query}”` : "Featured Properties"}</h2>
          <span className="text-sm text-muted-foreground">{properties.length} {properties.length === 1 ? "property" : "properties"}</span>
        </div>
        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-surface px-6 py-14 text-center">
            <SearchX className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">{query ? "No properties match your search" : "New properties coming soon"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Message {brokerFirstName(broker)} on WhatsApp to ask about current availability.</p>
            {query && (
              <Button asChild variant="outline" className="mt-5">
                <Link href={brokerBaseUrl(broker)}>View all properties</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p, i) => (
              <PublicPropertyCard key={p.id} property={p} index={i} preload={i < 2} href={propertyPublicUrl(broker, p.slug!)} />
            ))}
          </div>
        )}
      </section>

      {collections.length > 0 && (
        <section id="collections" className="container-page scroll-mt-20 py-6">
          <h2 className="mb-5 text-xl font-semibold tracking-tight">Collections</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {collections.map((c, i) => (
              <Link key={c.id} href={collectionPublicUrl(broker, c.slug)} className="group overflow-hidden rounded-2xl border bg-card shadow-soft">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {c.coverImage ? (
                    <Image src={c.coverImage} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <PropertyIllustration variant="courtyard" tone={i} />
                  )}
                </div>
                <div className="p-3 sm:p-4">
                  <p className="text-sm font-semibold sm:text-base">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <FolderOpen className="size-3.5" /> {c.propertyCount} Properties
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="about" className="container-page scroll-mt-20 py-10">
        <div className="grid gap-6 rounded-2xl border bg-card p-6 shadow-soft sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">About {broker.businessName}</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">
              {broker.description ?? `${broker.contactName} helps buyers and tenants find the right property${broker.city ? ` in ${broker.city}` : ""}. Reach out on WhatsApp for site visits, pricing and availability.`}
            </p>
          </div>
          <a href={buildWhatsAppUrl(broker.whatsappNumber, `Hi ${brokerFirstName(broker)}, I'm looking for a property. Can you help?`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 font-semibold text-white">
            <WhatsAppIcon className="size-5" /> Chat on WhatsApp
          </a>
        </div>
      </section>
    </main>
  );
}
