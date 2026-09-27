import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { WorkspaceRow } from "@/server/services/admin/admin.service";
import { PlanBadge, SubscriptionStatusBadge, SuspendedBadge } from "./ui";

/** Workspace list: a table on desktop, cards on mobile. */
export function WorkspaceTable({ rows }: { rows: WorkspaceRow[] }) {
  if (rows.length === 0) return <p className="px-5 pb-6 text-sm text-muted-foreground">No workspaces match.</p>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-surface text-left text-xs text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Workspace</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-3 py-2.5 font-medium">Plan</th>
              <th className="px-3 py-2.5 text-right font-medium">Properties</th>
              <th className="px-5 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-surface/60">
                <td className="max-w-[260px] px-5 py-3">
                  <Link href={`/admin/workspaces/${t.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <span className="truncate">{t.name}</span>
                    {t.status === "suspended" && <SuspendedBadge />}
                  </Link>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    /{t.slug ?? "—"}
                    {t.city && <span className="font-sans"> · {t.city}</span>}
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-3 py-3 text-muted-foreground">{t.ownerEmail ?? "—"}</td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <PlanBadge plan={t.plan} />
                    {t.subscriptionStatus !== "active" && <SubscriptionStatusBadge status={t.subscriptionStatus} />}
                  </span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{t.properties}</td>
                <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y border-t md:hidden">
        {rows.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/workspaces/${t.id}`} className="block px-5 py-3 hover:bg-surface/60">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{t.name}</span>
                <PlanBadge plan={t.plan} />
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {t.ownerEmail && <span className="truncate">{t.ownerEmail}</span>}
                <span>{t.properties} properties</span>
                <span>{formatDate(t.createdAt)}</span>
                {t.status === "suspended" && <SuspendedBadge />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
