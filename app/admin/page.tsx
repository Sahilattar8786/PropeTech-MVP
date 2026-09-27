import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, CalendarClock, CheckCircle2, CreditCard, Globe, Home, IndianRupee, MessageSquare, Sparkles, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/features/dashboard/stat-card";
import { WorkspaceTable } from "@/features/admin/workspace-table";
import { Panel } from "@/features/admin/ui";
import { formatNumber, formatPrice } from "@/lib/format";
import { requirePlatformAdmin } from "@/server/auth/session";
import { getPlatformOverview } from "@/server/services/admin/admin.service";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const { totals, revenue, attention, recent } = await getPlatformOverview();

  const tasks = [
    { count: attention.domainRequests, label: "domain request", href: "/admin/domains", icon: Globe },
    { count: attention.renewalsDue, label: "renewal due this week", plural: "renewals due this week", href: "/admin/subscriptions?filter=renewals", icon: CalendarClock },
    { count: attention.pastDue, label: "past-due subscription", href: "/admin/subscriptions?filter=past_due", icon: AlertTriangle },
  ].filter((t) => t.count > 0);

  return (
    <>
      <PageHeader title="Platform overview" description="Revenue, subscriptions and workspaces across PropFlow." />

      <section aria-label="Needs attention" className="mb-6">
        {tasks.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
            <CheckCircle2 className="size-4 text-emerald-600" /> Nothing needs attention right now.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {tasks.map((t) => (
              <Link key={t.href} href={t.href} className="group flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm hover:bg-amber-50">
                <t.icon className="size-4 shrink-0 text-amber-700" />
                <span className="flex-1">
                  <span className="font-semibold tabular-nums">{t.count}</span> {t.count === 1 ? t.label : (t.plural ?? `${t.label}s`)}
                </span>
                <ArrowRight className="size-4 text-amber-700 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Revenue</h2>
        <Link href="/admin/revenue" className="text-sm font-medium text-brand hover:underline">
          Details
        </Link>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Revenue">
        <StatCard label="MRR" value={formatPrice(revenue.mrr.mrr)} icon={IndianRupee} hint={`ARR ${formatPrice(revenue.mrr.arr)}`} />
        <StatCard label="Paying workspaces" value={formatNumber(revenue.mrr.paying)} icon={CreditCard} hint={revenue.mrr.paying ? `ARPA ${formatPrice(revenue.mrr.arpa)}/mo` : undefined} />
        <StatCard label="Active trials" value={formatNumber(revenue.trialing)} icon={Sparkles} />
        <StatCard label="Collected this month" value={formatPrice(revenue.collectedThisMonth)} icon={Wallet} hint={`Last month ${formatPrice(revenue.collectedLastMonth)}`} />
      </section>

      <h2 className="mt-8 mb-3 font-semibold">Platform</h2>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Platform">
        <StatCard label="Workspaces" value={formatNumber(totals.tenants)} icon={Building2} hint={`+${totals.signups30d} in 30 days${totals.suspended ? ` · ${totals.suspended} suspended` : ""}`} />
        <StatCard label="Users" value={formatNumber(totals.users)} icon={Users} />
        <StatCard label="Properties" value={formatNumber(totals.properties)} icon={Home} hint={`${formatNumber(totals.published)} published`} />
        <StatCard label="Leads" value={formatNumber(totals.leads)} icon={MessageSquare} />
      </section>

      <Panel
        className="mt-8"
        title="Newest workspaces"
        actions={
          <Link href="/admin/workspaces" className="text-sm font-medium text-brand hover:underline">
            All workspaces
          </Link>
        }
      >
        <WorkspaceTable rows={recent} />
      </Panel>
    </>
  );
}
