import Link from "next/link";
import { AlertTriangle, Globe } from "lucide-react";
import { formatDate, formatRelative } from "@/lib/format";
import type { DomainRequestRow } from "@/server/services/admin/domain-admin.service";
import { DomainActions } from "./row-actions";
import { DnsBadge, DomainSetupBadge, PlanBadge } from "./ui";

const NEXT_STEP: Record<DomainRequestRow["setupStatus"], (d: DomainRequestRow) => string | null> = {
  requested: (d) => `Add ${d.hostname} in Vercel → project → Settings → Domains, then mark it added.`,
  configured: (d) => (d.status === "verified" ? null : "On hosting. Waiting for the broker to add the TXT record and verify."),
  rejected: () => null,
  removal_requested: (d) => `The broker removed this domain. Delete ${d.hostname} from Vercel → Settings → Domains, then mark it removed.`,
};

export function DomainRequestCard({ domain, showWorkspace = true }: { domain: DomainRequestRow; showWorkspace?: boolean }) {
  const nextStep = NEXT_STEP[domain.setupStatus](domain);
  const live = domain.setupStatus === "configured" && domain.status === "verified";
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono font-medium break-all">
            <Globe className="size-4 shrink-0 text-muted-foreground" /> {domain.hostname}
          </p>
          {showWorkspace && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/admin/workspaces/${domain.tenantId}`} className="font-medium hover:underline">
                {domain.workspace.name}
              </Link>
              <PlanBadge plan={domain.plan} />
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <DomainSetupBadge status={domain.setupStatus} />
          {domain.setupStatus !== "removal_requested" && <DnsBadge status={domain.status} />}
          {live && <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Live</span>}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Requested {formatDate(domain.createdAt)}
        {domain.lastCheckedAt && ` · DNS checked ${formatRelative(domain.lastCheckedAt)}`}
        {domain.removalRequestedAt && ` · Removed by broker ${formatRelative(domain.removalRequestedAt)}`}
      </p>

      {!domain.planAllowsDomain && domain.setupStatus !== "removal_requested" && domain.setupStatus !== "rejected" && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> This workspace&apos;s plan doesn&apos;t include custom domains anymore.
        </p>
      )}
      {domain.rejectionReason && domain.setupStatus === "rejected" && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Rejected: {domain.rejectionReason}</p>}
      {nextStep && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">{nextStep}</p>}

      {domain.setupStatus !== "removal_requested" && domain.status !== "verified" && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">DNS records the broker needs</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left">
              <tbody className="font-mono text-xs">
                {[domain.routingRecord, domain.verificationRecord].map((r) => (
                  <tr key={r.type} className="border-t">
                    <td className="py-2 pr-3">{r.type}</td>
                    <td className="py-2 pr-3 break-all">{r.name}</td>
                    <td className="py-2 break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="mt-4">
        <DomainActions id={domain.id} hostname={domain.hostname} setupStatus={domain.setupStatus} dnsVerified={domain.status === "verified"} />
      </div>
    </article>
  );
}
