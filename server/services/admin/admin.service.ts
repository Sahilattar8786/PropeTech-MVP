import type { PlanId } from "@/lib/config/plans";
import { brokerBaseUrl } from "@/lib/urls";
import type { PlatformAdmin } from "@/server/auth/context";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import {
  AuditLog,
  Broker,
  Collection,
  Domain,
  isObjectId,
  Lead,
  Property,
  Subscription,
  Tenant,
  User,
  WhatsAppMessage,
  type IAuditLog,
  type IBroker,
  type ISubscription,
  type ITenant,
  type IUser,
} from "@/server/models";
import { expireTrials } from "@/server/services/subscriptions/subscription.service";
import { getRevenueOverview } from "./billing-admin.service";
import { ADMIN_PAGE_SIZE, auditAdmin, escapeRegex, lookupWorkspaces, pageCount, workspaceOf, type WorkspaceRef } from "./shared";

const DAY_MS = 86_400_000;

/* ─────────────────────────── Overview ─────────────────────────── */

export interface WorkspaceRow {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  ownerEmail?: string;
  plan: PlanId;
  subscriptionStatus: ISubscription["status"];
  status: ITenant["status"];
  properties: number;
  createdAt: string;
}

async function toWorkspaceRows(tenants: ITenant[]): Promise<WorkspaceRow[]> {
  const ids = tenants.map((t) => t._id);
  const [brokers, subs, owners, counts] = await Promise.all([
    Broker.find({ tenantId: { $in: ids } }).select("tenantId slug city").lean<IBroker[]>(),
    Subscription.find({ tenantId: { $in: ids } }).select("tenantId plan status").lean<ISubscription[]>(),
    User.find({ _id: { $in: tenants.map((t) => t.ownerId) } }).select("email").lean<Pick<IUser, "_id" | "email">[]>(),
    Property.aggregate<{ _id: unknown; count: number }>([{ $match: { tenantId: { $in: ids } } }, { $group: { _id: "$tenantId", count: { $sum: 1 } } }]),
  ]);
  const byTenant = <T extends { tenantId: unknown }>(rows: T[]) => new Map(rows.map((r) => [String(r.tenantId), r]));
  const brokerMap = byTenant(brokers);
  const subMap = byTenant(subs);
  const ownerMap = new Map(owners.map((u) => [String(u._id), u.email]));
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return tenants.map((t) => {
    const id = String(t._id);
    return {
      id,
      name: t.name,
      slug: brokerMap.get(id)?.slug,
      city: brokerMap.get(id)?.city ?? undefined,
      ownerEmail: ownerMap.get(String(t.ownerId)),
      plan: subMap.get(id)?.plan ?? "free",
      subscriptionStatus: subMap.get(id)?.status ?? "active",
      status: t.status,
      properties: countMap.get(id) ?? 0,
      createdAt: t.createdAt.toISOString(),
    };
  });
}

/** Platform-wide overview for PropFlow staff. */
export async function getPlatformOverview() {
  await connectDB();
  const monthAgo = new Date(Date.now() - 30 * DAY_MS);
  const [tenants, suspended, signups30d, users, properties, published, leads, revenue, domainRequests, pastDue, recent] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: "suspended" }),
    Tenant.countDocuments({ createdAt: { $gte: monthAgo } }),
    User.countDocuments(),
    Property.countDocuments(),
    Property.countDocuments({ status: { $ne: "draft" } }),
    Lead.countDocuments(),
    getRevenueOverview(),
    Domain.countDocuments({ setupStatus: { $in: ["requested", "removal_requested"] } }),
    Subscription.countDocuments({ status: "past_due" }),
    Tenant.find().sort({ createdAt: -1 }).limit(8).lean<ITenant[]>(),
  ]);
  return {
    totals: { tenants, suspended, signups30d, users, properties, published, leads },
    revenue,
    attention: { domainRequests, renewalsDue: revenue.renewalsDue, pastDue },
    recent: await toWorkspaceRows(recent),
  };
}

/** Badge counts for the admin sidebar. */
export async function getAdminNavCounts() {
  await connectDB();
  await expireTrials();
  const soon = new Date(Date.now() + 7 * DAY_MS);
  const [domains, renewals] = await Promise.all([
    Domain.countDocuments({ setupStatus: { $in: ["requested", "removal_requested"] } }),
    Subscription.countDocuments({ plan: { $ne: "free" }, status: { $in: ["active", "past_due"] }, priceOverride: { $ne: 0 }, currentPeriodEnd: { $lte: soon } }),
  ]);
  return { domains, renewals };
}

/* ─────────────────────────── Workspaces ─────────────────────────── */

export async function listWorkspaces(opts: { q?: string; status?: ITenant["status"]; plan?: PlanId; page?: number } = {}) {
  await connectDB();
  const page = Math.max(1, opts.page ?? 1);
  const query: Record<string, unknown> = {};
  if (opts.status) query.status = opts.status;

  const q = opts.q?.trim().slice(0, 100);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const [byBroker, byUser] = await Promise.all([
      Broker.find({ $or: [{ slug: rx }, { businessName: rx }, { email: rx }, { whatsappNumber: rx }, { customDomain: rx }] }).distinct("tenantId"),
      User.find({ email: rx }).distinct("tenantId"),
    ]);
    query.$or = [{ name: rx }, { _id: { $in: [...byBroker, ...byUser, ...(isObjectId(q) ? [q] : [])] } }];
  }
  if (opts.plan === "free") {
    // Workspaces without a subscription document are on Free too.
    query._id = { $nin: await Subscription.find({ plan: { $ne: "free" } }).distinct("tenantId") };
  } else if (opts.plan) {
    query._id = { $in: await Subscription.find({ plan: opts.plan }).distinct("tenantId") };
  }

  const [tenants, total] = await Promise.all([
    Tenant.find(query).sort({ createdAt: -1 }).skip((page - 1) * ADMIN_PAGE_SIZE).limit(ADMIN_PAGE_SIZE).lean<ITenant[]>(),
    Tenant.countDocuments(query),
  ]);
  return { items: await toWorkspaceRows(tenants), page, pages: pageCount(total), total };
}

export async function getWorkspaceDetail(tenantId: string) {
  if (!isObjectId(tenantId)) throw notFound("Workspace");
  await connectDB();
  const tenant = await Tenant.findById(tenantId).lean<ITenant>();
  if (!tenant) throw notFound("Workspace");

  const [broker, members, properties, published, leads, collections, messages] = await Promise.all([
    Broker.findOne({ tenantId }).lean<IBroker>(),
    User.find({ tenantId }).sort({ createdAt: 1 }).lean<IUser[]>(),
    Property.countDocuments({ tenantId }),
    Property.countDocuments({ tenantId, status: { $ne: "draft" } }),
    Lead.countDocuments({ tenantId }),
    Collection.countDocuments({ tenantId }),
    WhatsAppMessage.countDocuments({ tenantId, direction: "inbound" }),
  ]);

  return {
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      status: tenant.status,
      suspendedAt: tenant.suspendedAt?.toISOString(),
      suspendedReason: tenant.suspendedReason ?? undefined,
      createdAt: tenant.createdAt.toISOString(),
    },
    broker: broker && {
      slug: broker.slug,
      businessName: broker.businessName,
      contactName: broker.contactName,
      email: broker.email ?? undefined,
      whatsappNumber: broker.whatsappNumber,
      city: broker.city ?? undefined,
      customDomain: broker.customDomain ?? undefined,
      publicUrl: brokerBaseUrl(broker),
      whatsappConnected: broker.whatsapp.senderNumbers.length > 0,
    },
    members: members.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      isOwner: String(u._id) === String(tenant.ownerId),
      lastLoginAt: u.lastLoginAt?.toISOString(),
    })),
    usage: { properties, published, leads, collections, messages },
  };
}

/**
 * Suspension blocks the dashboard, hides the public site and stops WhatsApp intake.
 * Data is kept; reactivating restores everything.
 */
export async function setWorkspaceSuspended(admin: PlatformAdmin, tenantId: string, suspended: boolean, reason?: string) {
  if (!isObjectId(tenantId)) throw notFound("Workspace");
  await connectDB();
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw notFound("Workspace");
  if ((tenant.status === "suspended") === suspended) throw new AppError("CONFLICT", suspended ? "Workspace is already suspended" : "Workspace is already active");
  if (suspended) {
    tenant.status = "suspended";
    tenant.suspendedAt = new Date();
    tenant.suspendedReason = reason;
  } else {
    tenant.status = "active";
    tenant.suspendedAt = undefined;
    tenant.suspendedReason = undefined;
  }
  await tenant.save();
  await auditAdmin(admin, tenantId, suspended ? "workspace.suspended" : "workspace.reactivated", { type: "tenant", id: tenantId }, suspended ? { reason } : undefined);
  const broker = await Broker.findOne({ tenantId }).select("slug").lean<Pick<IBroker, "slug">>();
  return { slug: broker?.slug };
}

/* ─────────────────────────── Audit log ─────────────────────────── */

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  tenantId: string;
  workspace: WorkspaceRef;
  actor?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** `scope: "admin"` lists platform-admin actions across all workspaces; a tenantId lists everything in one workspace. */
export async function listAuditLog(opts: { scope?: "admin" | "all"; tenantId?: string; page?: number; pageSize?: number } = {}) {
  await connectDB();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? ADMIN_PAGE_SIZE;
  const query: Record<string, unknown> = {};
  if (opts.scope !== "all") query.action = /^admin\./;
  if (opts.tenantId) query.tenantId = opts.tenantId;

  const [docs, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean<IAuditLog[]>(),
    AuditLog.countDocuments(query),
  ]);
  const actorIds = [...new Set(docs.map((d) => d.actorId).filter(Boolean).map(String))];
  const [workspaces, actors] = await Promise.all([
    lookupWorkspaces(docs.map((d) => d.tenantId)),
    User.find({ _id: { $in: actorIds } }).select("email").lean<Pick<IUser, "_id" | "email">[]>(),
  ]);
  const actorEmail = new Map(actors.map((u) => [String(u._id), u.email]));
  const items: AuditRow[] = docs.map((d) => ({
    id: String(d._id),
    action: d.action,
    entityType: d.entityType,
    entityId: d.entityId ?? undefined,
    tenantId: String(d.tenantId),
    workspace: workspaceOf(workspaces, d.tenantId),
    actor: (d.actorId && actorEmail.get(String(d.actorId))) || (d.metadata?.adminEmail as string | undefined),
    metadata: d.metadata ?? undefined,
    createdAt: d.createdAt.toISOString(),
  }));
  return { items, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
