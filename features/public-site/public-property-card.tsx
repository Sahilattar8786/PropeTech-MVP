import Link from "next/link";
import { BedDouble, MapPin, Maximize2 } from "lucide-react";
import { PropertyImage } from "@/components/shared/property-image";
import { StatusBadge } from "@/components/shared/badges";
import type { PropertyDTO } from "@/lib/domain/property";
import { LISTING_TYPE_LABELS, RESIDENTIAL_TYPES } from "@/lib/domain/property";
import { formatArea, locationLabel, priceLabel } from "@/lib/format";

/** Customer-facing listing card used on broker sites and collections. */
export function PublicPropertyCard({ property, href, index = 0, preload = false }: { property: PropertyDTO; href: string; index?: number; preload?: boolean }) {
  const area = formatArea(property.area);
  return (
    <Link href={href} className="group block overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lifted">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <PropertyImage src={property.images[0]} alt={property.title} type={property.propertyType} seed={index} preload={preload} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {property.listingType && <span className="rounded-full bg-background/95 px-2 py-0.5 text-xs font-medium shadow-soft">For {LISTING_TYPE_LABELS[property.listingType]}</span>}
          {property.status !== "active" && <StatusBadge status={property.status} className="bg-background/95" />}
        </div>
      </div>
      <div className="p-4">
        <p className="text-lg font-semibold tracking-tight">{priceLabel(property)}</p>
        <h3 className="mt-0.5 line-clamp-1 font-medium">{property.title}</h3>
        {locationLabel(property.location) && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{locationLabel(property.location)}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {property.bedrooms && RESIDENTIAL_TYPES.includes(property.propertyType) ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
              <BedDouble className="size-3.5" /> {property.bedrooms} BHK
            </span>
          ) : null}
          {area && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
              <Maximize2 className="size-3.5" /> {area}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
