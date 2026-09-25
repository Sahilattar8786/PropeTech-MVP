import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Home, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PropertyCard } from "@/features/properties/property-card";
import { PropertyFilters } from "@/features/properties/property-filters";
import { propertyPublicUrl } from "@/lib/urls";
import { propertyFiltersSchema } from "@/lib/validation/property";
import { requireTenantContext } from "@/server/auth/session";
import { listLocalities, listProperties } from "@/server/services/properties/property.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage({ searchParams }: PageProps<"/dashboard/properties">) {
  const ctx = await requireTenantContext();
  const raw = await searchParams;
  const parsed = propertyFiltersSchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const filters = parsed.success ? parsed.data : { page: 1 };
  const [{ items, total, page, pageSize }, localities, broker] = await Promise.all([listProperties(ctx, filters), listLocalities(ctx), getBrokerForTenant(ctx.tenantId)]);
  const filtered = Object.keys(raw).some((k) => !["page", "focus"].includes(k));
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const pageHref = (n: number) => {
    const next = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    next.set("page", String(n));
    return `/dashboard/properties?${next}`;
  };

  return (
    <>
      <PageHeader
        title="Properties"
        description={total === 1 ? "1 property" : `${total} properties`}
        actions={
          <Button asChild className="h-9">
            <Link href="/dashboard/properties/new">
              <Plus className="size-4" /> Add Property
            </Link>
          </Button>
        }
      />
      <PropertyFilters localities={localities} />

      {items.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX} title="No properties match" description="Try a different search or clear some filters." action={<Button asChild variant="outline"><Link href="/dashboard/properties">Clear filters</Link></Button>} />
        ) : (
          <EmptyState
            icon={Home}
            title="Add your first property"
            description="Paste a WhatsApp property message and PropFlow will turn it into a listing — or send it straight to your PropFlow WhatsApp number."
            action={
              <>
                <Button asChild>
                  <Link href="/dashboard/properties/new">
                    <Plus className="size-4" /> Add Property
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/settings/whatsapp">Connect WhatsApp</Link>
                </Button>
              </>
            }
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p, i) => (
              <PropertyCard key={p.id} property={p} index={i} publicUrl={p.slug ? propertyPublicUrl(broker, p.slug) : undefined} />
            ))}
          </div>
          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>
                <Link href={pageHref(page - 1)} aria-disabled={page <= 1}>
                  <ChevronLeft className="size-4" /> Previous
                </Link>
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button asChild variant="outline" size="sm" className={page >= pages ? "pointer-events-none opacity-50" : undefined}>
                <Link href={pageHref(page + 1)} aria-disabled={page >= pages}>
                  Next <ChevronRight className="size-4" />
                </Link>
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
