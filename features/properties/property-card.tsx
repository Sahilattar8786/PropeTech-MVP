import Link from "next/link";
import { Eye, MapPin, Maximize2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineBadge, StatusBadge } from "@/components/shared/badges";
import { PropertyImage } from "@/components/shared/property-image";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { pipelineStateOf, type PropertyDTO } from "@/lib/domain/property";
import { configurationLabel, formatArea, formatNumber, locationLabel, priceLabel } from "@/lib/format";
import { ShareMenu } from "./share-menu";

/** Broker catalog card: image, price, configuration, location, area, status, views, leads, Edit/Share. */
export function PropertyCard({ property, publicUrl, index = 0, leads }: { property: PropertyDTO; publicUrl?: string; index?: number; leads?: number }) {
  const isDraft = property.status === "draft";
  const href = isDraft ? `/dashboard/properties/${property.id}/review` : `/dashboard/properties/${property.id}`;
  const area = formatArea(property.area);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lifted">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-muted">
        <PropertyImage src={property.images[0]} alt={property.title} type={property.propertyType} seed={index} className="transition-transform duration-500 group-hover:scale-[1.02]" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {isDraft ? <PipelineBadge state={pipelineStateOf(property)} className="bg-background/95 shadow-soft" /> : <StatusBadge status={property.status} className="bg-background/95 shadow-soft" />}
        </div>
        {property.images.length > 1 && <span className="absolute right-3 bottom-3 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">{property.images.length} photos</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-lg font-semibold tracking-tight">{property.price ? priceLabel(property) : <span className="text-muted-foreground">Price not set</span>}</p>
        <Link href={href} className="mt-0.5 line-clamp-1 font-medium hover:underline">
          {property.title}
        </Link>
        <p className="mt-0.5 text-sm text-muted-foreground">{configurationLabel(property)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {locationLabel(property.location) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {locationLabel(property.location)}
            </span>
          )}
          {area && (
            <span className="inline-flex items-center gap-1">
              <Maximize2 className="size-3" /> {area}
            </span>
          )}
        </div>
        {!isDraft && (
          <div className="mt-3 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" /> Views: <span className="font-medium text-foreground tabular-nums">{formatNumber(property.views)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <WhatsAppIcon className="size-3.5" /> WhatsApp Leads: <span className="font-medium text-foreground tabular-nums">{formatNumber(leads ?? property.whatsappClicks)}</span>
            </span>
          </div>
        )}
        <div className="mt-auto flex gap-2 pt-4">
          <Button asChild variant="outline" size="sm" className="h-8 flex-1">
            <Link href={href}>
              <Pencil className="size-3.5" /> {isDraft ? "Review" : "Edit"}
            </Link>
          </Button>
          {publicUrl && !isDraft ? <ShareMenu url={publicUrl} title={property.title} /> : null}
        </div>
      </div>
    </article>
  );
}
