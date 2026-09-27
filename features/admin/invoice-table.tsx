import Link from "next/link";
import { PLANS } from "@/lib/config/plans";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/billing";
import { formatDateIST } from "@/lib/format";
import type { AdminInvoiceRow } from "@/server/services/admin/billing-admin.service";
import { InvoiceActions } from "./row-actions";
import { InvoiceStatusBadge, rupees, TestModeBadge } from "./ui";

/** Payment ledger rows. `showWorkspace` is off on a workspace's own page. */
export function InvoiceTable({ rows, showWorkspace = true, empty = "No payments yet." }: { rows: AdminInvoiceRow[]; showWorkspace?: boolean; empty?: string }) {
  if (rows.length === 0) return <p className="px-5 pb-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-surface text-left text-xs text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Invoice</th>
              {showWorkspace && <th className="px-3 py-2.5 font-medium">Workspace</th>}
              <th className="px-3 py-2.5 font-medium">Plan · period</th>
              <th className="px-3 py-2.5 font-medium">Method</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id} className="border-b align-top last:border-0">
                <td className="px-5 py-3">
                  <span className="font-mono text-xs font-medium">{inv.number}</span>
                  <span className="block text-xs text-muted-foreground">{inv.paidAt ? formatDateIST(inv.paidAt) : formatDateIST(inv.createdAt)}</span>
                </td>
                {showWorkspace && (
                  <td className="max-w-[200px] px-3 py-3">
                    <Link href={`/admin/workspaces/${inv.tenantId}`} className="block truncate font-medium hover:underline">
                      {inv.workspace.name}
                    </Link>
                  </td>
                )}
                <td className="px-3 py-3">
                  {PLANS[inv.plan].name}
                  {inv.periodStart && inv.periodEnd && (
                    <span className="block text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateIST(inv.periodStart)} – {formatDateIST(inv.periodEnd)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {inv.method ? PAYMENT_METHOD_LABELS[inv.method] : inv.provider === "mock" ? "Test checkout" : inv.provider}
                  {inv.reference && <span className="block max-w-[160px] truncate font-mono text-xs" title={inv.reference}>{inv.reference}</span>}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums">{rupees(inv.amount)}</td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap gap-1">
                    <InvoiceStatusBadge status={inv.status} />
                    {!inv.livemode && <TestModeBadge />}
                  </span>
                  {inv.notes && <span className="mt-1 block max-w-[220px] text-xs whitespace-pre-line text-muted-foreground">{inv.notes}</span>}
                </td>
                <td className="px-5 py-2.5">
                  <InvoiceActions id={inv.id} number={inv.number} status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y border-t md:hidden">
        {rows.map((inv) => (
          <li key={inv.id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-medium">{inv.number}</p>
                {showWorkspace && (
                  <Link href={`/admin/workspaces/${inv.tenantId}`} className="block truncate text-sm font-medium hover:underline">
                    {inv.workspace.name}
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">
                  {PLANS[inv.plan].name} · {formatDateIST(inv.paidAt ?? inv.createdAt)}
                  {inv.method && ` · ${PAYMENT_METHOD_LABELS[inv.method]}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums">{rupees(inv.amount)}</p>
                <span className="mt-1 flex justify-end gap-1">
                  <InvoiceStatusBadge status={inv.status} />
                  {!inv.livemode && <TestModeBadge />}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <InvoiceActions id={inv.id} number={inv.number} status={inv.status} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
