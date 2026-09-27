import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FolderOpen, Home, MessageSquare, Pencil, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/features/dashboard/stat-card";
import { auditDetail, auditLabel } from "@/features/admin/audit-format";
import { DomainRequestCard } from "@/features/admin/domain-request-card";
import { InvoiceTable } from "@/features/admin/invoice-table";
import { RecordPaymentDialog } from "@/features/admin/record-payment-dialog";
import { WorkspaceStatusButton } from "@/features/admin/row-actions";
import { SubscriptionDialog, type SubscriptionSnapshot } from "@/features/admin/subscription-dialog";
import { Panel, PlanBadge, RenewalBadge, rupees, SubscriptionStatusBadge, SuspendedBadge } from "@/features/admin/ui";
import { PLANS } from "@/lib/config/plans";
import { formatDate, formatDateIST, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { AppError } from "@/server/lib/errors";
import { isObjectId } from "@/server/models";
import { requirePlatformAdmin } from "@/server/auth/session";
import { getWorkspaceDetail, listAuditLog } from "@/server/services/admin/admin.service";
import { getTenantSubscriptionRow, listInvoices } from "@/server/services/admin/billing-admin.service";
import { listDomainRequests } from "@/server/services/admin/domain-admin.service";

export const metadata: Metadata = { title: "Workspace" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  );
}

export default async function WorkspaceDetailPage({ params }: PageProps<"/admin/workspaces/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  const detail = await getWorkspaceDetail(id).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  });
  if (!detail) notFound();

  const [sub, invoices, domains, activity] = await Promise.all([
    getTenantSubscriptionRow(id),
    listInvoices({ tenantId: id, includeTest: true, pageSize: 20 }),
    listDomainRequests({ tenantId: id, filter: "all" }),
    listAuditLog({ tenantId: id, scope: "all", pageSize: 20 }),
  ]);
  const { tenant, broker, members, usage } = detail;
  const plan = sub?.plan ?? "free";
  const snapshot: SubscriptionSnapshot | null = sub && {
    plan: sub.plan,
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    priceOverride: sub.priceOverride,
    adminNotes: sub.adminNotes,
  };
  const suspended = tenant.status === "suspended";

  return (
    <>
      <Link href="/admin/workspaces" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Workspaces
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {tenant.name} {suspended && <SuspendedBadge />}
          </span>
        }
        description={`Created ${formatDate(tenant.createdAt)} · ${tenant.id}`}
        actions={
          <>
            {broker && !suspended && (
              <Button asChild variant="outline">
                <a href={broker.publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Website
                </a>
              </Button>
            )}
            <WorkspaceStatusButton tenantId={tenant.id} name={tenant.name} suspended={suspended} />
          </>
        }
      />

      {suspended && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Suspended {tenant.suspendedAt && formatRelative(tenant.suspendedAt)}
          {tenant.suspendedReason && <> — “{tenant.suspendedReason}”</>}. The dashboard, public website and WhatsApp intake are blocked.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Subscription"
          actions={
            <>
              <RecordPaymentDialog
                tenantId={tenant.id}
                workspace={tenant.name}
                current={snapshot}
                trigger={
                  <Button size="sm" variant="outline">
                    <Wallet /> Record payment
                  </Button>
                }
              />
              <SubscriptionDialog
                tenantId={tenant.id}
                workspace={tenant.name}
                current={snapshot}
                trigger={
                  <Button size="sm">
                    <Pencil /> Manage
                  </Button>
                }
              />
            </>
          }
        >
          <dl className="divide-y px-5 pb-4">
            <Detail label="Plan">
              <span className="inline-flex flex-wrap justify-end gap-1.5">
                <PlanBadge plan={plan} />
                {sub && <SubscriptionStatusBadge status={sub.status} />}
                {sub && <RenewalBadge state={sub.renewal} periodEnd={sub.currentPeriodEnd} />}
              </span>
            </Detail>
            <Detail label="Price">
              {plan === "free" ? "—" : sub?.monthlyPrice === 0 ? "Complimentary" : `${rupees(sub?.monthlyPrice ?? PLANS[plan].priceMonthly)}/mo${sub?.priceOverride !== undefined ? " (custom)" : ""}`}
            </Detail>
            {sub?.status === "trialing" && sub.trialEndsAt && <Detail label="Trial ends">{formatDateIST(sub.trialEndsAt)}</Detail>}
            {sub?.currentPeriodEnd && plan !== "free" && sub.status !== "trialing" && <Detail label="Renews">{formatDateIST(sub.currentPeriodEnd)}</Detail>}
            {sub?.adminNotes && (
              <div className="py-2 text-sm">
                <dt className="text-muted-foreground">Internal notes</dt>
                <dd className="mt-1 whitespace-pre-line">{sub.adminNotes}</dd>
              </div>
            )}
          </dl>
        </Panel>

        <Panel title="Broker profile">
          {broker ? (
            <dl className="divide-y px-5 pb-4">
              <Detail label="Business">{broker.businessName}</Detail>
              <Detail label="Contact">{broker.contactName}</Detail>
              <Detail label="WhatsApp">
                <span className="font-mono">+{broker.whatsappNumber}</span>
                <span className="block text-xs text-muted-foreground">{broker.whatsappConnected ? "Connected for property intake" : "Not connected for intake"}</span>
              </Detail>
              {broker.email && <Detail label="Email">{broker.email}</Detail>}
              {broker.city && <Detail label="City">{broker.city}</Detail>}
              <Detail label="Website">
                <span className="font-mono text-xs">{broker.publicUrl.replace(/^https?:\/\//, "")}</span>
              </Detail>
            </dl>
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No broker profile.</p>
          )}
        </Panel>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Usage">
        <StatCard label="Properties" value={formatNumber(usage.properties)} icon={Home} hint={`${usage.published} published · limit ${PLANS[plan].entitlements.maxProperties.toLocaleString("en-IN")}`} />
        <StatCard label="Leads" value={formatNumber(usage.leads)} icon={Users} />
        <StatCard label="Collections" value={formatNumber(usage.collections)} icon={FolderOpen} hint={`limit ${PLANS[plan].entitlements.maxCollections.toLocaleString("en-IN")}`} />
        <StatCard label="WhatsApp messages" value={formatNumber(usage.messages)} icon={MessageSquare} hint="received" />
      </section>

      <Panel className="mt-6" title="Payments" description="Including test-mode payments.">
        <InvoiceTable rows={invoices.items} showWorkspace={false} />
      </Panel>

      {domains.items.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold">Custom domains</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {domains.items.map((d) => (
              <DomainRequestCard key={d.id} domain={d} showWorkspace={false} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Team">
          <ul className="divide-y border-t">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block truncate text-muted-foreground">{m.email}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block font-medium text-foreground capitalize">{m.isOwner ? "Owner" : m.role}</span>
                  {m.lastLoginAt ? `Seen ${formatRelative(m.lastLoginAt)}` : "Never signed in"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Activity" description="Latest changes by the team and PropFlow admins.">
          {activity.items.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ol className="divide-y border-t">
              {activity.items.map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-sm">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {auditLabel(a.action)}
                      {a.action.startsWith("admin.") && <span className="ml-1.5 rounded bg-foreground px-1 py-px text-[10px] font-semibold text-background uppercase">Admin</span>}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.createdAt}>
                      {formatDateTime(a.createdAt)}
                    </time>
                  </span>
                  {(auditDetail(a) || a.actor) && (
                    <span className="block truncate text-xs text-muted-foreground">{[auditDetail(a), a.actor].filter(Boolean).join(" · ")}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
