import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceTable } from "@/features/admin/workspace-table";
import { Pagination, Panel, param, withQuery } from "@/features/admin/ui";
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/config/plans";
import { requirePlatformAdmin } from "@/server/auth/session";
import { listWorkspaces } from "@/server/services/admin/admin.service";

export const metadata: Metadata = { title: "Workspaces" };

const STATUSES = ["active", "suspended"] as const;
const selectClass = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm";

export default async function WorkspacesPage({ searchParams }: PageProps<"/admin/workspaces">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = param(sp.q)?.trim() ?? "";
  const plan = PLAN_IDS.includes(param(sp.plan) as PlanId) ? (param(sp.plan) as PlanId) : undefined;
  const status = STATUSES.find((s) => s === param(sp.status));
  const { items, page, pages, total } = await listWorkspaces({ q, plan, status, page: Number(param(sp.page)) || 1 });

  return (
    <>
      <PageHeader title="Workspaces" description="Every broker workspace on PropFlow." />
      {/* A plain GET form: works without JavaScript and keeps filters in the URL. */}
      <form role="search" className="mb-5 flex flex-wrap gap-2" action="/admin/workspaces">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Name, slug, email, phone or domain" aria-label="Search workspaces" className="h-9 bg-background pl-9" />
        </div>
        <select name="plan" defaultValue={plan ?? ""} aria-label="Plan" className={selectClass}>
          <option value="">All plans</option>
          {PLAN_IDS.map((p) => (
            <option key={p} value={p}>
              {PLANS[p].name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className={selectClass}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <Button type="submit" className="h-9">
          Search
        </Button>
      </form>

      <Panel title={`${total.toLocaleString("en-IN")} workspace${total === 1 ? "" : "s"}`}>
        <WorkspaceTable rows={items} />
      </Panel>
      <Pagination page={page} pages={pages} href={(p) => withQuery("/admin/workspaces", { q, plan, status, page: p })} />
    </>
  );
}
