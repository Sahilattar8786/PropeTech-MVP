import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Eye, Home, Inbox, LayoutGrid, Plus, Share2, Sparkles, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineBadge, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { PropertyImage } from "@/components/shared/property-image";
import { StatCard } from "@/features/dashboard/stat-card";
import { pipelineStateOf } from "@/lib/domain/property";
import { formatNumber, formatRelative, locationLabel, priceLabel } from "@/lib/format";
import { brokerBaseUrl } from "@/lib/urls";
import { requireTenantContext } from "@/server/auth/session";
import { getDashboardStats } from "@/server/services/properties/property.service";
import { getBrokerForTenant } from "@/server/services/tenants/broker.service";
import { connectDB } from "@/server/db/connect";
import { Broker } from "@/server/models";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requireTenantContext();
  const { welcome } = await searchParams;
  await connectDB();
  const [stats, broker, connection] = await Promise.all([
    getDashboardStats(ctx),
    getBrokerForTenant(ctx.tenantId),
    Broker.findOne({ tenantId: ctx.tenantId }).select("whatsapp.senderNumbers").lean<{ whatsapp?: { senderNumbers?: string[] } }>(),
  ]);
  const whatsappConnected = (connection?.whatsapp?.senderNumbers?.length ?? 0) > 0;
  const siteUrl = brokerBaseUrl(broker);
  const firstName = ctx.name.split(" ")[0];

  const checklist = [
    { done: true, label: "Create your broker workspace", href: "/dashboard/settings/profile" },
    { done: whatsappConnected, label: "Connect your WhatsApp number", href: "/dashboard/settings/whatsapp" },
    { done: stats.total > 0, label: "Add your first property", href: "/dashboard/properties/new" },
    { done: stats.active + stats.sold > 0, label: "Publish and share a listing", href: "/dashboard/properties" },
  ];
  const showChecklist = welcome === "1" || checklist.some((c) => !c.done);

  return (
    <>
      <PageHeader
        title={welcome === "1" ? `Welcome to PropFlow, ${firstName}` : `Good to see you, ${firstName}`}
        description={welcome === "1" ? "Your broker workspace and website are ready." : "Here's what's happening with your inventory."}
        actions={
          <>
            <Button asChild variant="outline" className="h-9">
              <a href={siteUrl} target="_blank" rel="noreferrer">
                <Share2 className="size-4" /> My website
              </a>
            </Button>
            <Button asChild className="h-9">
              <Link href="/dashboard/properties/new">
                <Plus className="size-4" /> Add Property
              </Link>
            </Button>
          </>
        }
      />

      {showChecklist && (
        <section className="mb-6 rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Get set up</h2>
            <span className="text-xs text-muted-foreground">
              {checklist.filter((c) => c.done).length} of {checklist.length} done
            </span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors hover:bg-muted">
                  {item.done ? <CheckCircle2 className="size-5 text-emerald-500" /> : <Circle className="size-5 text-muted-foreground" />}
                  <span className={item.done ? "text-muted-foreground line-through" : "font-medium"}>{item.label}</span>
                  {!item.done && <ArrowRight className="ml-auto size-4 text-muted-foreground" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Key metrics">
        <StatCard label="Total Properties" value={formatNumber(stats.total)} icon={Home} hint={stats.drafts ? `${stats.drafts} in draft` : undefined} />
        <StatCard label="Active" value={formatNumber(stats.active)} icon={LayoutGrid} />
        <StatCard label="Sold" value={formatNumber(stats.sold)} icon={TrendingUp} />
        <StatCard label="Views" value={formatNumber(stats.views)} icon={Eye} />
        <StatCard label="WhatsApp Leads" value={formatNumber(stats.leads)} icon={Users} className="col-span-2 lg:col-span-1" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-semibold">Top properties</h2>
            <Link href="/dashboard/properties" className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          </div>
          {stats.topProperties.length === 0 ? (
            <p className="px-5 pb-8 text-sm text-muted-foreground">Published properties will appear here with their views and leads.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-y bg-surface text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Property</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Views</th>
                    <th className="px-5 py-2.5 text-right font-medium">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProperties.map((p, i) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/properties/${p.id}`} className="flex items-center gap-3">
                          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg">
                            <PropertyImage src={p.images[0]} alt={p.title} type={p.propertyType} sizes="40px" seed={i} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{p.title}</span>
                            <span className="block text-xs text-muted-foreground">{priceLabel(p)}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumber(p.views)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatNumber(stats.leadCounts[p.id] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-brand" /> Drafts to review
            </h2>
            <Link href="/dashboard/properties?status=draft" className="text-sm font-medium text-brand hover:underline">
              All drafts
            </Link>
          </div>
          {stats.recentDrafts.length === 0 ? (
            <div className="mt-4 rounded-xl bg-surface p-4 text-sm text-muted-foreground">
              Send a property to your WhatsApp number and its draft will show up here.
              <Link href="/dashboard/whatsapp" className="mt-3 flex items-center gap-1 font-medium text-foreground hover:underline">
                <Inbox className="size-4" /> Open WhatsApp inbox
              </Link>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {stats.recentDrafts.map((d, i) => (
                <li key={d.id}>
                  <Link href={`/dashboard/properties/${d.id}/review`} className="flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:bg-muted">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                      <PropertyImage src={d.images[0]} alt={d.title} type={d.propertyType} sizes="48px" seed={i + 1} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[locationLabel(d.location, { short: true }), d.price ? priceLabel(d) : null].filter(Boolean).join(" · ") || formatRelative(d.updatedAt)}
                      </span>
                    </span>
                    <PipelineBadge state={pipelineStateOf(d)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
