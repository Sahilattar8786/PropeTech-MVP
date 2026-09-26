import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FolderOpen } from "lucide-react";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { TrackView } from "@/features/landing/track-view";
import { PublicPropertyCard } from "@/features/public-site/public-property-card";
import { getAppUrl } from "@/lib/config/site";
import { brokerFirstName } from "@/lib/domain/broker";
import { brokerBaseUrl, collectionPublicUrl, propertyPublicUrl } from "@/lib/urls";
import { buildWhatsAppUrl } from "@/lib/whatsapp-link";
import { getPublicCollection } from "@/server/services/collections/collection.service";
import { getPublicBrokerBySlug } from "@/server/services/tenants/broker.service";

export const revalidate = 300;

/** No pages at build time; each listing is rendered on first request, then cached (ISR). */
export async function generateStaticParams() {
  return [];
}

async function load(brokerSlug: string, collectionSlug: string) {
  const broker = await getPublicBrokerBySlug(brokerSlug);
  if (!broker) return null;
  const data = await getPublicCollection(broker.tenantId, collectionSlug);
  return data ? { broker, ...data } : null;
}

export async function generateMetadata({ params }: PageProps<"/[brokerSlug]/collections/[collectionSlug]">): Promise<Metadata> {
  const { brokerSlug, collectionSlug } = await params;
  const data = await load(brokerSlug, collectionSlug);
  if (!data) return { title: "Collection not found" };
  const { broker, collection } = data;
  const title = `${collection.name} | ${broker.businessName}`;
  const description = collection.description ?? `${collection.propertyCount} handpicked properties from ${broker.businessName}.`;
  const url = collectionPublicUrl(broker, collection.slug);
  const image = collection.coverImage ? (collection.coverImage.startsWith("http") ? collection.coverImage : `${getAppUrl()}${collection.coverImage}`) : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PublicCollectionPage({ params }: PageProps<"/[brokerSlug]/collections/[collectionSlug]">) {
  const { brokerSlug, collectionSlug } = await params;
  const data = await load(brokerSlug, collectionSlug);
  if (!data) notFound();
  const { broker, collection, properties } = data;
  const url = collectionPublicUrl(broker, collection.slug);

  return (
    <main className="container-page py-8 sm:py-10">
      <TrackView event="collection_viewed" collectionId={collection.id} />
      <Link href={brokerBaseUrl(broker)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> All properties
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand">
            <FolderOpen className="size-4" /> Collection · {properties.length} {properties.length === 1 ? "property" : "properties"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{collection.name}</h1>
          {collection.description && <p className="mt-2 max-w-2xl text-muted-foreground">{collection.description}</p>}
        </div>
        <a
          href={buildWhatsAppUrl(broker.whatsappNumber, `Hi ${brokerFirstName(broker)}, I'm interested in properties from your "${collection.name}" collection.\n${url}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 font-semibold text-white"
        >
          <WhatsAppIcon className="size-4" /> Enquire on WhatsApp
        </a>
      </div>
      {properties.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed bg-surface px-6 py-14 text-center text-muted-foreground">No properties are available in this collection right now.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p, i) => (
            <PublicPropertyCard key={p.id} property={p} index={i} preload={i < 2} href={propertyPublicUrl(broker, p.slug!)} />
          ))}
        </div>
      )}
    </main>
  );
}
