import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Building2, Car, Check, Hash, MapPin, Maximize2, Sofa } from "lucide-react";
import { StatusBadge } from "@/components/shared/badges";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { TrackView } from "@/features/landing/track-view";
import { BrokerAvatar } from "@/features/public-site/broker-chrome";
import { Gallery } from "@/features/public-site/gallery";
import { PublicPropertyCard } from "@/features/public-site/public-property-card";
import { getAppUrl } from "@/lib/config/site";
import { brokerFirstName } from "@/lib/domain/broker";
import { LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, RESIDENTIAL_TYPES } from "@/lib/domain/property";
import { configurationLabel, formatArea, furnishingLabel, locationLabel, priceLabel } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { brokerBaseUrl, propertyPublicUrl } from "@/lib/urls";
import { buildWhatsAppUrl } from "@/lib/whatsapp-link";
import { getPublicProperty, getSimilarProperties } from "@/server/services/properties/public-property.service";
import { getPublicBrokerBySlug } from "@/server/services/tenants/broker.service";

export const revalidate = 300;

/** No pages at build time; each listing is rendered on first request, then cached (ISR). */
export async function generateStaticParams() {
  return [];
}

async function load(brokerSlug: string, propertySlug: string) {
  const broker = await getPublicBrokerBySlug(brokerSlug);
  if (!broker) return null;
  const property = await getPublicProperty(broker.tenantId, propertySlug);
  return property ? { broker, property } : null;
}

const absolute = (url: string) => (url.startsWith("http") ? url : `${getAppUrl()}${url}`);

export async function generateMetadata({ params }: PageProps<"/[brokerSlug]/property/[propertySlug]">): Promise<Metadata> {
  const { brokerSlug, propertySlug } = await params;
  const data = await load(brokerSlug, propertySlug);
  if (!data) return { title: "Property not found" };
  const { broker, property } = data;
  const title = property.seo?.metaTitle ?? `${property.title}${property.price ? ` – ${priceLabel(property)}` : ""}`;
  const description =
    property.seo?.metaDescription ??
    [configurationLabel(property), locationLabel(property.location), property.price ? priceLabel(property) : null, formatArea(property.area)].filter(Boolean).join(" · ");
  const url = propertyPublicUrl(broker, property.slug!);
  const image = property.images[0] ? absolute(property.images[0]) : undefined;
  return {
    title: { absolute: `${title} | ${broker.businessName}` },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, siteName: broker.businessName, images: image ? [{ url: image, alt: property.title }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
    robots: property.status === "sold" || property.status === "rented" ? { index: false } : undefined,
  };
}

export default async function PublicPropertyPage({ params }: PageProps<"/[brokerSlug]/property/[propertySlug]">) {
  const { brokerSlug, propertySlug } = await params;
  const data = await load(brokerSlug, propertySlug);
  if (!data) notFound();
  const { broker, property } = data;
  const url = propertyPublicUrl(broker, property.slug!);
  const similar = await getSimilarProperties(property, 3);
  const available = property.status === "active" || property.status === "reserved";
  const residential = RESIDENTIAL_TYPES.includes(property.propertyType);
  const location = locationLabel(property.location);
  const mapQuery = [property.location?.address, property.location?.locality, property.location?.city, property.location?.pincode].filter(Boolean).join(", ");

  const facts = [
    residential && property.bedrooms ? { icon: BedDouble, label: "Configuration", value: `${property.bedrooms} BHK` } : null,
    property.area ? { icon: Maximize2, label: "Area", value: formatArea(property.area)! } : null,
    { icon: Building2, label: "Type", value: PROPERTY_TYPE_LABELS[property.propertyType] },
    property.bathrooms ? { icon: Bath, label: "Bathrooms", value: String(property.bathrooms) } : null,
    property.parking ? { icon: Car, label: "Parking", value: String(property.parking) } : null,
    property.furnishing ? { icon: Sofa, label: "Furnishing", value: furnishingLabel(property.furnishing)! } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    url,
    description: property.description ?? undefined,
    image: property.images.map(absolute),
    datePosted: property.publishedAt,
    ...(property.price && available
      ? { offers: { "@type": "Offer", price: property.price.amount, priceCurrency: "INR", availability: "https://schema.org/InStock", businessFunction: property.listingType === "rent" ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell" } }
      : {}),
    ...(property.location?.locality || property.location?.city
      ? { contentLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: property.location?.locality ?? property.location?.city, addressRegion: property.location?.state, postalCode: property.location?.pincode, addressCountry: "IN" } } }
      : {}),
    provider: { "@type": "RealEstateAgent", name: broker.businessName, url: brokerBaseUrl(broker) },
  };

  const cta = available ? (
    <WhatsAppButton brokerPhone={broker.whatsappNumber} brokerName={broker.contactName} businessName={broker.businessName} property={property} propertyUrl={url} className="w-full" />
  ) : (
    <a href={buildWhatsAppUrl(broker.whatsappNumber, `Hi ${brokerFirstName(broker)}, I saw ${property.title} (${property.propertyId}) is no longer available. Do you have similar properties?\n${url}`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border font-semibold">
      Ask about similar properties
    </a>
  );

  return (
    <main className="container-page pt-4 pb-32 sm:pt-6 lg:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {available && <TrackView event="property_viewed" propertyId={property.id} />}

      {!available && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          This property has been {property.status === "rented" ? "rented out" : "sold"}. Browse similar properties below or ask {brokerFirstName(broker)} what else is available.
        </div>
      )}

      <Gallery images={property.images} title={property.title} type={property.propertyType} />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <section>
            <div className="flex flex-wrap items-center gap-2">
              {property.listingType && <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">For {LISTING_TYPE_LABELS[property.listingType]}</span>}
              {property.status !== "active" && <StatusBadge status={property.status} />}
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{priceLabel(property)}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{property.title}</h1>
            {location && (
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4 shrink-0" /> {location}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="rounded-xl border bg-card p-3.5">
                  <f.icon className="size-4 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">{f.label}</p>
                  <p className="font-semibold">{f.value}</p>
                </div>
              ))}
            </div>
          </section>

          {property.highlights.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Highlights</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {property.highlights.map((h) => (
                  <span key={h} className="rounded-full border bg-card px-3 py-1 text-sm font-medium">
                    {h}
                  </span>
                ))}
              </div>
            </section>
          )}

          {property.description && (
            <section>
              <h2 className="text-lg font-semibold">About this property</h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground text-pretty">{property.description}</p>
            </section>
          )}

          {property.amenities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Amenities</h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 shrink-0 text-brand" /> {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mapQuery && (
            <section>
              <h2 className="text-lg font-semibold">Location</h2>
              <p className="mt-1 text-sm text-muted-foreground">{location}</p>
              <div className="mt-3 overflow-hidden rounded-2xl border bg-muted">
                <iframe
                  title={`Map of ${location ?? "property location"}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-64 w-full sm:h-80"
                />
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <BrokerAvatar broker={broker} size={48} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{broker.businessName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {broker.contactName}
                  {broker.city ? ` · ${broker.city}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-5 hidden lg:block">{cta}</div>
            <p className="mt-3 hidden text-center text-xs text-muted-foreground lg:block">WhatsApp {formatPhone(broker.whatsappNumber)}</p>
            {property.propertyId && (
              <p className="mt-4 flex items-center justify-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
                <Hash className="size-3.5" /> Property ID: <span className="font-mono font-medium text-foreground">{property.propertyId}</span>
              </p>
            )}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight">Similar properties</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p, i) => (
              <PublicPropertyCard key={p.id} property={p} index={i + 1} href={propertyPublicUrl(broker, p.slug!)} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile sticky enquiry bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold">{priceLabel(property)}</span>
          <span className="truncate text-muted-foreground">{configurationLabel(property)}</span>
        </div>
        {cta}
      </div>
    </main>
  );
}
