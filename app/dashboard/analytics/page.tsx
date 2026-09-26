import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Eye, Lock, MousePointerClick, Percent, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/badges";
import { DailyChart } from "@/features/analytics/daily-chart";
import { StatCard } from "@/features/dashboard/stat-card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireTenantContext } from "@/server/auth/session";
import { getAnalyticsOverview } from "@/server/services/analytics/analytics.service";
import { getEntitlements } from "@/server/services/subscriptions/subscription.service";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const ctx = await requireTenantContext();
  const { range } = await searchParams;
  const days = RANGES.find((r) => String(r) === range) ?? 30;
  const entitlements = await getEntitlements(ctx.tenantId);

  if (!entitlements.analytics) {
    return (
      <>
        <PageHeader title="Analytics" />
        <EmptyState icon={Lock} title="Analytics is part of Pro" description="See views, WhatsApp clicks and leads per property and per day." action={<Button asChild><Link href="/dashboard/settings/billing">View plans</Link></Button>} />
      </>
    );
  }

  const { series, totals, topProperties } = await getAnalyticsOverview(ctx, days);

  return (
    <>
      <PageHeader title="Analytics" description="How customers engage with your listings." />
      <nav className="mb-5 inline-flex rounded-lg border bg-background p-0.5" aria-label="Date range">
        {RANGES.map((r) => (
          <Link key={r} href={`/dashboard/analytics?range=${r}`} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", r === days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")} aria-current={r === days ? "true" : undefined}>
            Last {r} days
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totals">
        <StatCard label="Property views" value={formatNumber(totals.views)} icon={Eye} />
        <StatCard label="WhatsApp clicks" value={formatNumber(totals.clicks)} icon={MousePointerClick} />
        <StatCard label="Leads" value={formatNumber(totals.leads)} icon={Users} />
        <StatCard label="Click-through rate" value={`${(totals.clickRate * 100).toFixed(1)}%`} icon={Percent} hint="WhatsApp clicks ÷ views" />
      </section>

      <div className="mt-6">
        <DailyChart data={series} />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-soft">
        <h2 className="px-5 pt-5 pb-3 font-semibold">Top properties <span className="text-sm font-normal text-muted-foreground">· all time</span></h2>
        {topProperties.length === 0 ? (
          <div className="px-5 pb-6">
            <EmptyState icon={BarChart3} title="No published properties yet" description="Publish a property to start seeing views and enquiries." className="py-10" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y bg-surface text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Property</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Views</th>
                  <th className="px-3 py-2.5 text-right font-medium">WhatsApp clicks</th>
                  <th className="px-5 py-2.5 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {topProperties.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="max-w-[260px] px-5 py-3">
                      <Link href={`/dashboard/properties/${p.id}`} className="block truncate font-medium hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-3 text-right">{formatNumber(p.views)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(p.whatsappClicks)}</td>
                    <td className="px-5 py-3 text-right">{p.views ? `${((p.whatsappClicks / p.views) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
