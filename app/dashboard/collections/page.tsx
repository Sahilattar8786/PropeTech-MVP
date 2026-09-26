import type { Metadata } from "next";
import Link from "next/link";
import { Eye, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PropertyImage } from "@/components/shared/property-image";
import { CollectionFormDialog } from "@/features/collections/collection-form-dialog";
import { ShareMenu } from "@/features/properties/share-menu";
import { formatNumber } from "@/lib/format";
import { collectionPublicUrl } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { listCollections } from "@/server/services/collections/collection.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const ctx = await requireTenantContext();
  const [collections, broker] = await Promise.all([listCollections(ctx), getBrokerForTenant(ctx.tenantId)]);
  const newButton = (
    <Button className="h-9">
      <Plus className="size-4" /> New collection
    </Button>
  );

  return (
    <>
      <PageHeader title="Collections" description="Organise inventory by location, type, price, BHK or investment category — and share one link." actions={<CollectionFormDialog trigger={newButton} />} />
      {collections.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No collections yet"
          description="Create collections like “Whitefield Properties” or “Plots under ₹1 Crore” and share them with customers in one link."
          action={<CollectionFormDialog trigger={newButton} />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((c, i) => (
            <article key={c.id} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <Link href={`/dashboard/collections/${c.id}`} className="relative block aspect-[16/9] overflow-hidden bg-muted">
                <PropertyImage src={c.coverImage} alt={c.name} seed={i} type="apartment" />
              </Link>
              <div className="p-4">
                <Link href={`/dashboard/collections/${c.id}`} className="font-semibold hover:underline">
                  {c.name}
                </Link>
                <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen className="size-3.5" /> {c.propertyCount} {c.propertyCount === 1 ? "property" : "properties"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3.5" /> {formatNumber(c.views)} {c.views === 1 ? "view" : "views"}
                  </span>
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline" size="sm" className="h-8 flex-1">
                    <Link href={`/dashboard/collections/${c.id}`}>Manage</Link>
                  </Button>
                  <ShareMenu url={collectionPublicUrl(broker, c.slug)} title={c.name} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
