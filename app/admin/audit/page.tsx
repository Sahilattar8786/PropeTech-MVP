import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { auditDetail, auditLabel } from "@/features/admin/audit-format";
import { Pagination, param } from "@/features/admin/ui";
import { formatDateTime } from "@/lib/format";
import { requirePlatformAdmin } from "@/server/auth/session";
import { listAuditLog } from "@/server/services/admin/admin.service";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const { items, page, pages } = await listAuditLog({ scope: "admin", page: Number(param(sp.page)) || 1 });

  return (
    <>
      <PageHeader title="Audit log" description="Every change made by PropFlow admins, newest first. Each entry is also kept in the workspace's own history." />
      {items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No admin actions yet" description="Plan changes, payments, refunds, domain decisions and suspensions will be listed here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <ol className="divide-y">
            {items.map((a) => {
              const detail = auditDetail(a);
              return (
                <li key={a.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[160px_1fr_auto] sm:gap-4">
                  <time className="text-xs text-muted-foreground tabular-nums sm:pt-0.5" dateTime={a.createdAt}>
                    {formatDateTime(a.createdAt)}
                  </time>
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{auditLabel(a.action)}</span>
                      {" · "}
                      <Link href={`/admin/workspaces/${a.tenantId}`} className="hover:underline">
                        {a.workspace.name}
                      </Link>
                    </p>
                    {detail && <p className="truncate text-xs text-muted-foreground" title={detail}>{detail}</p>}
                  </div>
                  <span className="truncate text-xs text-muted-foreground sm:pt-0.5 sm:text-right">{a.actor ?? "—"}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <Pagination page={page} pages={pages} href={(p) => `/admin/audit?page=${p}`} />
    </>
  );
}
