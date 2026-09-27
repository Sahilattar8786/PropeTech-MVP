import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DomainRequestCard } from "@/features/admin/domain-request-card";
import { FilterTabs, Pagination, param, withQuery } from "@/features/admin/ui";
import { DOMAIN_SETUP_LABELS, DOMAIN_SETUP_STATUSES } from "@/lib/domain/billing";
import { requirePlatformAdmin } from "@/server/auth/session";
import { listDomainRequests, type DomainRequestFilter } from "@/server/services/admin/domain-admin.service";

export const metadata: Metadata = { title: "Domain requests" };

const FILTERS: DomainRequestFilter[] = [...DOMAIN_SETUP_STATUSES, "all"];

const EMPTY: Record<DomainRequestFilter, string> = {
  requested: "No domains waiting to be added to hosting.",
  configured: "No custom domains on hosting yet.",
  rejected: "No rejected requests.",
  removal_requested: "No domains waiting to be removed from hosting.",
  all: "No workspace has added a custom domain yet.",
};

export default async function DomainRequestsPage({ searchParams }: PageProps<"/admin/domains">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const requested = param(sp.filter);
  const filter = FILTERS.includes(requested as DomainRequestFilter) ? (requested as DomainRequestFilter) : "requested";
  const { items, counts, page, pages } = await listDomainRequests({ filter, page: Number(param(sp.page)) || 1 });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Domain requests"
        description="Custom domains need a manual step in the hosting project. A domain goes live once it's on hosting and the broker's DNS is verified."
      />
      <FilterTabs
        label="Filter domain requests"
        active={filter}
        href={(key) => withQuery("/admin/domains", { filter: key })}
        tabs={FILTERS.map((key) => ({ key, label: key === "all" ? "All" : DOMAIN_SETUP_LABELS[key], count: key === "all" ? total : counts[key] }))}
      />
      {items.length === 0 ? (
        <EmptyState icon={Globe} title="Nothing here" description={EMPTY[filter]} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((d) => (
            <DomainRequestCard key={d.id} domain={d} />
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} href={(p) => withQuery("/admin/domains", { filter, page: p })} />
    </>
  );
}
