import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ReelStudio } from "@/features/reels/reel-studio";
import { DEFAULT_BRAND_COLOR } from "@/lib/domain/broker";
import { PUBLIC_STATUSES } from "@/lib/domain/property";
import { buildDefaultReel, restoreReel } from "@/lib/reels/reel-spec";
import { propertyPublicUrl } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { getProperty } from "@/server/services/properties/property.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Instagram Reel" };

export default async function PropertyReelPage({ params }: PageProps<"/dashboard/properties/[id]/reel">) {
  const { id } = await params;
  const ctx = await requireTenantContext();
  let property;
  try {
    property = await getProperty(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const broker = await getBrokerForTenant(ctx.tenantId);
  const backHref = `/dashboard/properties/${id}`;

  const header = (
    <PageHeader
      eyebrow={
        <Link href={backHref} className="inline-flex min-w-0 max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4 shrink-0" /> <span className="truncate">{property.title}</span>
        </Link>
      }
      title="Instagram Reel"
      description="Turn this property's photos into a vertical video: a title slide, one slide per photo, and a WhatsApp slide."
    />
  );

  if (property.images.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={ImagePlus}
          title="Add photos first"
          description="A reel is made from the property's photos. Add at least one photo, then come back here."
          action={
            <Button asChild>
              <Link href={backHref}>Add photos</Link>
            </Button>
          }
        />
      </>
    );
  }

  const publicUrl = PUBLIC_STATUSES.includes(property.status) && property.slug ? propertyPublicUrl(broker, property.slug) : undefined;
  const defaults = buildDefaultReel(property, broker, publicUrl);

  return (
    <>
      {header}
      <ReelStudio
        propertyId={property.id}
        fileName={property.slug ?? property.propertyId?.toLowerCase() ?? "property"}
        images={property.images}
        initial={restoreReel(property.reel, property.images, defaults)}
        defaults={defaults}
        brand={{ name: broker.businessName, color: broker.brandColor ?? DEFAULT_BRAND_COLOR, propertyId: property.propertyId }}
      />
    </>
  );
}
