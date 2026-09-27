import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, StickyNote, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog } from "@/features/admin/record-payment-dialog";
import { SubscriptionDialog } from "@/features/admin/subscription-dialog";
import { FilterTabs, Pagination, param, PlanBadge, RenewalBadge, rupees, SubscriptionStatusBadge, SuspendedBadge, withQuery } from "@/features/admin/ui";
import { formatDateIST } from "@/lib/format";
import { requirePlatformAdmin } from "@/server/auth/session";
import {
  listSubscriptions,
  SUBSCRIPTION_FILTER_LABELS,
  SUBSCRIPTION_FILTERS,
  type AdminSubscriptionRow,
  type SubscriptionFilter,
} from "@/server/services/admin/billing-admin.service";

export const metadata: Metadata = { title: "Subscriptions" };

function DateCell({ row }: { row: AdminSubscriptionRow }) {
  if (row.status === "trialing" && row.trialEndsAt) return <span>Trial ends {formatDateIST(row.trialEndsAt)}</span>;
  if (row.currentPeriodEnd && row.plan !== "free") return <span>Renews {formatDateIST(row.currentPeriodEnd)}</span>;
  return <span className="text-muted-foreground">—</span>;
}

function PriceCell({ row }: { row: AdminSubscriptionRow }) {
  if (row.plan === "free") return <span className="text-muted-foreground">—</span>;
  if (row.monthlyPrice === 0) return <span className="text-muted-foreground">Complimentary</span>;
  return (
    <span>
      {rupees(row.monthlyPrice)}
      <span className="text-muted-foreground">/mo</span>
      {row.priceOverride !== undefined && <span className="block text-xs text-muted-foreground">Custom price</span>}
    </span>
  );
}

function RowActions({ row }: { row: AdminSubscriptionRow }) {
  const snapshot = { plan: row.plan, status: row.status, trialEndsAt: row.trialEndsAt, currentPeriodEnd: row.currentPeriodEnd, priceOverride: row.priceOverride, adminNotes: row.adminNotes };
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <RecordPaymentDialog
        tenantId={row.tenantId}
        workspace={row.workspace.name}
        current={snapshot}
        trigger={
          <Button size="sm" variant="outline">
            <Wallet /> Record payment
          </Button>
        }
      />
      <SubscriptionDialog tenantId={row.tenantId} workspace={row.workspace.name} current={snapshot} trigger={<Button size="sm">Manage</Button>} />
    </div>
  );
}

export default async function SubscriptionsPage({ searchParams }: PageProps<"/admin/subscriptions">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const requested = param(sp.filter);
  const filter = (SUBSCRIPTION_FILTERS as readonly string[]).includes(requested ?? "") ? (requested as SubscriptionFilter) : "paying";
  const { items, counts, page, pages } = await listSubscriptions({ filter, page: Number(param(sp.page)) || 1 });

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Change plans, extend trials, set negotiated prices and record offline payments. Changes apply immediately and never charge the broker."
      />
      <FilterTabs
        label="Filter subscriptions"
        active={filter}
        href={(key) => withQuery("/admin/subscriptions", { filter: key })}
        tabs={SUBSCRIPTION_FILTERS.map((key) => ({ key, label: SUBSCRIPTION_FILTER_LABELS[key], count: counts[key] }))}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={filter === "renewals" ? "No renewals due this week" : `No ${SUBSCRIPTION_FILTER_LABELS[filter].toLowerCase()} subscriptions`}
          description={filter === "renewals" ? "Paid subscriptions whose renewal date is past or within 7 days show up here, so you can collect the next payment." : undefined}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-soft lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Workspace</th>
                  <th className="px-3 py-3 font-medium">Plan</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Dates</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.tenantId} className="border-b align-top last:border-0">
                    <td className="max-w-[240px] px-5 py-3">
                      <Link href={`/admin/workspaces/${row.tenantId}`} className="flex items-center gap-2 font-medium hover:underline">
                        <span className="truncate">{row.workspace.name}</span>
                        {row.workspace.suspended && <SuspendedBadge />}
                      </Link>
                      {row.adminNotes && (
                        <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground" title={row.adminNotes}>
                          <StickyNote className="mt-0.5 size-3 shrink-0" /> <span className="line-clamp-1">{row.adminNotes}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <PlanBadge plan={row.plan} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1">
                        <SubscriptionStatusBadge status={row.status} />
                        <RenewalBadge state={row.renewal} periodEnd={row.currentPeriodEnd} />
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <PriceCell row={row} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <DateCell row={row} />
                    </td>
                    <td className="px-5 py-2.5">
                      <RowActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 lg:hidden">
            {items.map((row) => (
              <li key={row.tenantId} className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/workspaces/${row.tenantId}`} className="min-w-0 truncate font-medium hover:underline">
                    {row.workspace.name}
                  </Link>
                  <PlanBadge plan={row.plan} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                  <SubscriptionStatusBadge status={row.status} />
                  <RenewalBadge state={row.renewal} periodEnd={row.currentPeriodEnd} />
                  {row.workspace.suspended && <SuspendedBadge />}
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm tabular-nums">
                  <PriceCell row={row} />
                  <DateCell row={row} />
                </div>
                <div className="mt-3">
                  <RowActions row={row} />
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={pages} href={(p) => withQuery("/admin/subscriptions", { filter, page: p })} />
        </>
      )}
    </>
  );
}
