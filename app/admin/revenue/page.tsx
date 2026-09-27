import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, IndianRupee, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/features/dashboard/stat-card";
import { InvoiceTable } from "@/features/admin/invoice-table";
import { RevenueChart } from "@/features/admin/revenue-chart";
import { FilterTabs, Pagination, Panel, param, PlanBadge, rupees, withQuery } from "@/features/admin/ui";
import { PLANS } from "@/lib/config/plans";
import { INVOICE_STATUS_LABELS } from "@/lib/domain/billing";
import { formatPrice } from "@/lib/format";
import { requirePlatformAdmin } from "@/server/auth/session";
import { getRevenueOverview, INVOICE_FILTERS, listInvoices, type InvoiceFilter } from "@/server/services/admin/billing-admin.service";

export const metadata: Metadata = { title: "Revenue" };

const PAID_PLANS = ["pro", "business"] as const;

export default async function RevenuePage({ searchParams }: PageProps<"/admin/revenue">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const includeTest = param(sp.test) === "1";
  const status = (INVOICE_FILTERS as readonly string[]).includes(param(sp.status) ?? "") ? (param(sp.status) as InvoiceFilter) : "all";
  const page = Number(param(sp.page)) || 1;

  const [revenue, invoices] = await Promise.all([getRevenueOverview({ includeTest }), listInvoices({ status, includeTest, page })]);
  const { mrr } = revenue;
  const href = (overrides: Record<string, string | number | undefined>) =>
    withQuery("/admin/revenue", { test: includeTest ? 1 : undefined, status: status === "all" ? undefined : status, ...overrides });

  return (
    <>
      <PageHeader
        title="Revenue"
        description="MRR comes from active paid subscriptions. Collected revenue comes from recorded payments (paid, net of refunds), by IST month."
        actions={
          <Link href={href({ test: includeTest ? undefined : 1, page: undefined })} className="inline-flex items-center rounded-lg border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted" aria-pressed={includeTest}>
            {includeTest ? "Hide test payments" : "Include test payments"}
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Revenue totals">
        <StatCard label="MRR" value={formatPrice(mrr.mrr)} icon={IndianRupee} hint={`${mrr.paying} paying · ARPA ${formatPrice(mrr.arpa)}`} />
        <StatCard label="ARR" value={formatPrice(mrr.arr)} icon={TrendingUp} hint="MRR × 12" />
        <StatCard label="Collected this month" value={formatPrice(revenue.collectedThisMonth)} icon={Wallet} hint={`Last month ${formatPrice(revenue.collectedLastMonth)}`} />
        <StatCard label="Last 12 months" value={formatPrice(revenue.collectedTrailing12)} icon={CalendarRange} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Collected per month" description={includeTest ? "Including test-mode payments" : "Live payments only"}>
          <div className="px-5 pb-5">
            <RevenueChart data={revenue.series} />
          </div>
        </Panel>
        <Panel title="MRR by plan" description={`${revenue.trialing} workspaces on a trial aren't counted`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y bg-surface text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Plan</th>
                <th className="px-3 py-2.5 text-right font-medium">Paying</th>
                <th className="px-5 py-2.5 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {PAID_PLANS.map((plan) => (
                <tr key={plan} className="border-b">
                  <td className="px-5 py-3">
                    <PlanBadge plan={plan} />
                    <span className="block pt-1 text-xs text-muted-foreground">List ₹{PLANS[plan].priceMonthly.toLocaleString("en-IN")}/mo</span>
                  </td>
                  <td className="px-3 py-3 text-right">{mrr.byPlan[plan].count}</td>
                  <td className="px-5 py-3 text-right font-medium">{rupees(mrr.byPlan[plan].mrr)}</td>
                </tr>
              ))}
              <tr>
                <td className="px-5 py-3 font-medium">Total</td>
                <td className="px-3 py-3 text-right font-medium">{mrr.paying}</td>
                <td className="px-5 py-3 text-right font-semibold">{rupees(mrr.mrr)}</td>
              </tr>
            </tbody>
          </table>
          <p className="px-5 py-4 text-xs text-muted-foreground">Custom prices are used where set. Complimentary (₹0) plans are excluded.</p>
        </Panel>
      </div>

      <Panel className="mt-6" title="Payments" description={includeTest ? undefined : "Test-mode payments are hidden."}>
        <div className="px-5">
          <FilterTabs
            label="Filter payments"
            active={status}
            href={(key) => href({ status: key === "all" ? undefined : key, page: undefined })}
            tabs={INVOICE_FILTERS.map((key) => ({ key, label: key === "all" ? "All" : INVOICE_STATUS_LABELS[key] }))}
          />
        </div>
        <InvoiceTable rows={invoices.items} empty="No payments recorded yet. Record one from a workspace or the Subscriptions page." />
        <div className="px-5 pb-4">
          <Pagination page={invoices.page} pages={invoices.pages} href={(p) => href({ page: p })} />
        </div>
      </Panel>
    </>
  );
}
