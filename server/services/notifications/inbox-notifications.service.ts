import type { TenantContext } from "@/server/auth/context";
import { connectDB } from "@/server/db/connect";
import { Lead, Property, type ILead, type IProperty } from "@/server/models";

export interface AppNotification {
  id: string;
  kind: "draft_ready" | "processing_failed" | "lead";
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

/** In-app notification feed derived from recent drafts and leads. */
export async function getNotifications(ctx: TenantContext): Promise<AppNotification[]> {
  await connectDB();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [drafts, leads] = await Promise.all([
    Property.find({ tenantId: ctx.tenantId, status: "draft", reviewedAt: { $exists: false }, "ingestion.stage": { $in: ["completed", "failed"] }, updatedAt: { $gte: since } })
      .sort({ updatedAt: -1 })
      .limit(6)
      .select("title ingestion updatedAt source")
      .lean<IProperty[]>(),
    Lead.find({ tenantId: ctx.tenantId, status: "new", createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(6).lean<ILead[]>(),
  ]);
  const items: AppNotification[] = [
    ...drafts.map((d) => ({
      id: `p-${d._id}`,
      kind: d.ingestion?.stage === "failed" ? ("processing_failed" as const) : ("draft_ready" as const),
      title: d.ingestion?.stage === "failed" ? "Couldn't process a property" : "Property draft ready",
      body: d.ingestion?.stage === "failed" ? "Review it manually or retry AI processing." : d.title,
      href: `/dashboard/properties/${d._id}/review`,
      createdAt: d.updatedAt.toISOString(),
    })),
    ...leads.map((l) => ({
      id: `l-${l._id}`,
      kind: "lead" as const,
      title: "New WhatsApp lead",
      body: l.interest,
      href: "/dashboard/leads",
      createdAt: l.createdAt.toISOString(),
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
}
