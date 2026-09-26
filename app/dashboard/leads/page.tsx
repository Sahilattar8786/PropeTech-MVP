import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { LeadStatusSelect } from "@/features/leads/lead-status-select";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/domain/lead";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireTenantContext } from "@/server/auth/session";
import { LEAD_STATUSES, type LeadStatus } from "@/server/models/lead";
import { listLeads } from "@/server/services/leads/lead.service";

export const metadata: Metadata = { title: "Leads" };


export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  const ctx = await requireTenantContext();
  const { status } = await searchParams;
  const filter = LEAD_STATUSES.includes(status as LeadStatus) ? (status as LeadStatus) : undefined;
  const { items, statusCounts } = await listLeads(ctx, { status: filter });
  const total = Object.values(statusCounts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHeader title="Leads" description="Customers who tapped “I'm Interested — WhatsApp Broker” on your listings." />
      <nav className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Filter leads">
        {[{ key: undefined, label: "All", count: total }, ...LEAD_STATUSES.map((s) => ({ key: s, label: LEAD_STATUS_LABELS[s], count: statusCounts[s] ?? 0 }))].map((tab) => (
          <Link
            key={tab.label}
            href={tab.key ? `/dashboard/leads?status=${tab.key}` : "/dashboard/leads"}
            className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium", filter === tab.key ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground")}
          >
            {tab.label} <span className="tabular-nums opacity-70">{tab.count}</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filter ? `No ${LEAD_STATUS_LABELS[filter].toLowerCase()} leads` : "No leads yet"}
          description="When a customer taps the WhatsApp button on one of your listings, the enquiry is recorded here with the property they asked about."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-soft md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Property</th>
                  <th className="px-3 py-3 font-medium">Customer Interest</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="max-w-[220px] px-5 py-3">
                      {lead.propertyId && lead.propertyTitle ? (
                        <Link href={`/dashboard/properties/${lead.propertyId}`} className="block truncate font-medium hover:underline">
                          {lead.propertyTitle}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{lead.notes ?? "—"}</span>
                      )}
                      {lead.propertyCode && <span className="font-mono text-xs text-muted-foreground">{lead.propertyCode}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <WhatsAppIcon className="size-3.5 text-whatsapp" /> {lead.interest}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(lead.createdAt)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{LEAD_SOURCE_LABELS[lead.source]}</td>
                    <td className="px-5 py-3">
                      <LeadStatusSelect leadId={lead.id} status={lead.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {items.map((lead) => (
              <li key={lead.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lead.propertyTitle ?? "Deleted property"}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{lead.interest}</p>
                  </div>
                  <LeadStatusSelect leadId={lead.id} status={lead.status} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatDateTime(lead.createdAt)} · {LEAD_SOURCE_LABELS[lead.source]}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
