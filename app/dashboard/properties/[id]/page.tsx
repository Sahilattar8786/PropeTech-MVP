import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clapperboard, ChevronLeft, ExternalLink, Eye, Hash, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { StatCard } from "@/features/dashboard/stat-card";
import { PropertyEditor } from "@/features/properties/property-editor";
import { PublishedNotice } from "@/features/properties/publish-success-dialog";
import { ShareMenu } from "@/features/properties/share-menu";
import { DeletePropertyButton, StatusControl } from "@/features/properties/status-control";
import { formatDate, formatNumber } from "@/lib/format";
import { propertyPublicUrl } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { connectDB } from "@/server/db/connect";
import { AppError } from "@/server/lib/errors";
import { Lead } from "@/server/models";
import { getProperty } from "@/server/services/properties/property.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Property" };

export default async function PropertyDetailPage({ params, searchParams }: PageProps<"/dashboard/properties/[id]">) {
  const { id } = await params;
  const { published } = await searchParams;
  const ctx = await requireTenantContext();
  let property;
  try {
    property = await getProperty(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  if (property.status === "draft") redirect(`/dashboard/properties/${id}/review`);
  await connectDB();
  const [broker, leads] = await Promise.all([getBrokerForTenant(ctx.tenantId), Lead.countDocuments({ tenantId: ctx.tenantId, propertyId: id })]);
  const publicUrl = property.slug ? propertyPublicUrl(broker, property.slug) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/properties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Properties
          </Link>
        }
        title={property.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={property.status} />
            {property.propertyId && <span className="font-mono text-xs">{property.propertyId}</span>}
            {property.publishedAt && <span>· Published {formatDate(property.publishedAt)}</span>}
          </span>
        }
        actions={
          <>
            <StatusControl propertyId={property.id} status={property.status} />
            {property.images.length > 0 && (
              <Button asChild variant="outline" className="h-9">
                <Link href={`/dashboard/properties/${property.id}/reel`}>
                  <Clapperboard className="size-4" /> Create Reel
                </Link>
              </Button>
            )}
            {publicUrl && (
              <>
                <Button asChild variant="outline" className="h-9">
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> View
                  </a>
                </Button>
                <ShareMenu url={publicUrl} title={property.title} size="default" />
              </>
            )}
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Views" value={formatNumber(property.views)} icon={Eye} />
        <StatCard label="WhatsApp clicks" value={formatNumber(property.whatsappClicks)} icon={WhatsAppIcon} />
        <StatCard label="Leads" value={formatNumber(leads)} icon={Users} />
        <StatCard label="Property ID" value={property.propertyId ?? "—"} icon={Hash} />
      </section>

      {publicUrl && (
        <div className="mb-6 flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft">
          <span className="text-sm text-muted-foreground">Public link</span>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-sm hover:underline">
            {publicUrl.replace(/^https?:\/\//, "")}
          </a>
        </div>
      )}

      {published === "1" && publicUrl && <PublishedNotice url={publicUrl} title={property.title} />}
      <PropertyEditor key={property.updatedAt} property={property} mode="edit" />

      <div className="mt-8 flex justify-end border-t pt-6">
        <DeletePropertyButton propertyId={property.id} title={property.title} />
      </div>
    </>
  );
}
