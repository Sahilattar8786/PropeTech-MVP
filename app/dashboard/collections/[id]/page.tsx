import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CollectionEditor, DeleteCollectionButton } from "@/features/collections/collection-editor";
import { CollectionFormDialog } from "@/features/collections/collection-form-dialog";
import { ShareMenu } from "@/features/properties/share-menu";
import { collectionPublicUrl } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { getCollectionWithProperties } from "@/server/services/collections/collection.service";
import { listPublishedInventory } from "@/server/services/properties/property.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionDetailPage({ params }: PageProps<"/dashboard/collections/[id]">) {
  const { id } = await params;
  const ctx = await requireTenantContext();
  let data;
  try {
    data = await getCollectionWithProperties(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const [broker, candidates] = await Promise.all([getBrokerForTenant(ctx.tenantId), listPublishedInventory(ctx)]);
  const { collection, properties } = data;
  const url = collectionPublicUrl(broker, collection.slug);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/dashboard/collections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Collections
          </Link>
        }
        title={collection.name}
        description={
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate font-mono text-xs hover:underline">
            {url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3 shrink-0" />
          </a>
        }
        actions={
          <>
            <CollectionFormDialog
              collection={collection}
              trigger={
                <Button variant="outline" className="h-9">
                  <Pencil className="size-4" /> Edit
                </Button>
              }
            />
            <ShareMenu url={url} title={collection.name} size="default" />
          </>
        }
      />
      {collection.description && <p className="-mt-2 mb-6 max-w-2xl text-sm text-muted-foreground">{collection.description}</p>}
      <CollectionEditor key={collection.updatedAt} collectionId={collection.id} items={properties} inventory={candidates} />
      <div className="mt-8 flex justify-end border-t pt-6">
        <DeleteCollectionButton collectionId={collection.id} name={collection.name} />
      </div>
    </>
  );
}
