import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PropertyType } from "@/lib/domain/property";
import { PropertyIllustration, type IllustrationVariant } from "./property-illustration";

const VARIANT_BY_TYPE: Partial<Record<PropertyType, IllustrationVariant>> = {
  villa: "villa",
  bungalow: "villa",
  house: "villa",
  building: "courtyard",
  office: "office",
  commercial: "office",
  shop: "office",
  warehouse: "office",
  plot: "plot",
};

/** Next/Image with a calm illustrated fallback when a listing has no photos. */
export function PropertyImage({
  src,
  alt,
  type = "apartment",
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  preload = false,
  className,
  seed = 0,
}: {
  src?: string;
  alt: string;
  type?: PropertyType;
  sizes?: string;
  preload?: boolean;
  className?: string;
  seed?: number;
}) {
  if (!src) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-muted", className)}>
        <PropertyIllustration variant={VARIANT_BY_TYPE[type] ?? "tower"} tone={seed} label={alt} />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} preload={preload} className={cn("object-cover", className)} />;
}
