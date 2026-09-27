import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/config/plans";
import {
  DOMAIN_SETUP_LABELS,
  INVOICE_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type DomainSetupStatus,
  type InvoiceStatus,
  type RenewalState,
  type SubscriptionStatus,
} from "@/lib/domain/billing";
import { formatDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";

/* Server-safe presentational pieces shared by the admin pages. */

const inr = new Intl.NumberFormat("en-IN");

/** Exact rupees for ledgers and prices: ₹1,49,900. */
export function rupees(amount: number): string {
  return `₹${inr.format(amount)}`;
}

function Pill({ className, children, title }: { className: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

const PLAN_TONE: Record<PlanId, string> = {
  free: "bg-muted text-muted-foreground ring-border",
  pro: "bg-brand-soft text-brand ring-brand/20",
  business: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function PlanBadge({ plan }: { plan: PlanId }) {
  return <Pill className={PLAN_TONE[plan]}>{PLANS[plan].name}</Pill>;
}

const SUB_TONE: Record<SubscriptionStatus, string> = {
  trialing: "bg-sky-50 text-sky-800 ring-sky-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  past_due: "bg-red-50 text-red-700 ring-red-200",
  canceled: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Pill className={SUB_TONE[status]}>{SUBSCRIPTION_STATUS_LABELS[status]}</Pill>;
}

export function RenewalBadge({ state, periodEnd }: { state: RenewalState | null; periodEnd?: string }) {
  if (!state) return null;
  return (
    <Pill className={state === "overdue" ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-200"} title={periodEnd ? `Renewal due ${formatDateIST(periodEnd)}` : undefined}>
      {state === "overdue" ? "Renewal overdue" : "Renews soon"}
    </Pill>
  );
}

const INVOICE_TONE: Record<InvoiceStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  refunded: "bg-sky-50 text-sky-800 ring-sky-200",
  void: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Pill className={INVOICE_TONE[status]}>{INVOICE_STATUS_LABELS[status]}</Pill>;
}

export function TestModeBadge() {
  return <Pill className="bg-zinc-100 text-zinc-600 ring-zinc-200">Test</Pill>;
}

const SETUP_TONE: Record<DomainSetupStatus, string> = {
  requested: "bg-amber-50 text-amber-800 ring-amber-200",
  configured: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  removal_requested: "bg-orange-50 text-orange-800 ring-orange-200",
};

export function DomainSetupBadge({ status }: { status: DomainSetupStatus }) {
  return <Pill className={SETUP_TONE[status]}>{DOMAIN_SETUP_LABELS[status]}</Pill>;
}

export function DnsBadge({ status }: { status: "pending" | "verified" | "failed" }) {
  const label = { pending: "DNS pending", verified: "DNS verified", failed: "DNS not found" }[status];
  const tone = { pending: "bg-muted text-muted-foreground ring-border", verified: "bg-emerald-50 text-emerald-700 ring-emerald-200", failed: "bg-red-50 text-red-700 ring-red-200" }[status];
  return <Pill className={tone}>{label}</Pill>;
}

export function SuspendedBadge() {
  return <Pill className="bg-red-50 text-red-700 ring-red-200">Suspended</Pill>;
}

/** Pill tabs driven by a query param, like the leads filter. */
export function FilterTabs<T extends string>({
  tabs,
  active,
  href,
  label,
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  href: (key: T) => string;
  label: string;
}) {
  return (
    <nav className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={href(tab.key)}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
            tab.key === active ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tabular-nums opacity-70">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      <span className="text-muted-foreground">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="inline-flex items-center gap-1 rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted">
            <ChevronLeft className="size-4" /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className="inline-flex items-center gap-1 rounded-lg border bg-background px-3 py-1.5 font-medium hover:bg-muted">
            Next <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Builds `/path?a=1&b=2`, dropping empty values. */
export function withQuery(path: string, params: Record<string, string | number | undefined | null | false>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false && v !== "") search.set(k, String(v));
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function Panel({ title, description, actions, children, className }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card shadow-soft", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** First value of a search param. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
