import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { StatCard } from "@/features/dashboard/stat-card";
import { Building2, Home, Users, Globe, MessageSquare } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { requirePlatformAdmin } from "@/server/auth/session";
import { getPlatformOverview } from "@/server/services/admin/admin.service";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  await requirePlatformAdmin();
  const { totals, tenants } = await getPlatformOverview();
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b bg-background">
        <div className="container-page flex h-14 items-center justify-between">
          <Logo href="/admin" />
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Platform admin</span>
        </div>
      </header>
      <main className="container-page py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Workspaces" value={formatNumber(totals.tenants)} icon={Building2} />
          <StatCard label="Users" value={formatNumber(totals.users)} icon={Users} />
          <StatCard label="Properties" value={formatNumber(totals.properties)} icon={Home} />
          <StatCard label="Published" value={formatNumber(totals.published)} icon={Globe} />
          <StatCard label="Leads" value={formatNumber(totals.leads)} icon={MessageSquare} />
        </section>
        <section className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-soft">
          <h2 className="px-5 pt-5 pb-3 font-semibold">Recent workspaces</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y bg-surface text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Workspace</th>
                  <th className="px-3 py-2.5 font-medium">City</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 text-right font-medium">Properties</th>
                  <th className="px-5 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{t.name}</p>
                      {t.slug && (
                        <Link href={`/${t.slug}`} className="font-mono text-xs text-muted-foreground hover:underline">
                          /{t.slug}
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{t.city ?? "—"}</td>
                    <td className="px-3 py-3 capitalize">
                      {t.plan}
                      {t.status === "trialing" && <span className="ml-1 text-xs text-muted-foreground">(trial)</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.properties}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
