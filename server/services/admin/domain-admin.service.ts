import { PLANS, type PlanId } from "@/lib/config/plans";
import { DOMAIN_SETUP_STATUSES, type DomainSetupStatus } from "@/lib/domain/billing";
import type { PlatformAdmin } from "@/server/auth/context";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import { Domain, isObjectId, ObjectId, Subscription, type IDomain, type ISubscription } from "@/server/models";
import { checkDomainDns, detachDomain, setupStatusOf, syncBrokerCustomDomain, toDomainDTO, type DomainDTO } from "@/server/services/domains/domain.service";
import { ADMIN_PAGE_SIZE, auditAdmin, lookupWorkspaces, pageCount, workspaceOf, type WorkspaceRef } from "./shared";

export interface DomainRequestRow extends DomainDTO {
  tenantId: string;
  workspace: WorkspaceRef;
  plan: PlanId;
  /** False when the workspace has since moved to a plan without custom domains. */
  planAllowsDomain: boolean;
  createdAt: string;
  lastCheckedAt?: string;
  removalRequestedAt?: string;
}

export type DomainRequestFilter = DomainSetupStatus | "all";

/** Domains created before the setup workflow existed get their status written once, so queries can use it. */
async function backfillSetupStatus() {
  await Domain.updateMany({ setupStatus: { $exists: false }, status: "verified" }, { $set: { setupStatus: "configured" } });
  await Domain.updateMany({ setupStatus: { $exists: false } }, { $set: { setupStatus: "requested" } });
}

export async function listDomainRequests(opts: { filter?: DomainRequestFilter; page?: number; tenantId?: string } = {}) {
  await connectDB();
  await backfillSetupStatus();
  const filter = opts.filter ?? "requested";
  const page = Math.max(1, opts.page ?? 1);
  const query: Record<string, unknown> = {};
  if (filter !== "all") query.setupStatus = filter;
  if (opts.tenantId) query.tenantId = opts.tenantId;
  // Work queues are handled oldest first.
  const sort = filter === "requested" || filter === "removal_requested" ? 1 : -1;

  const [docs, total, grouped] = await Promise.all([
    Domain.find(query).sort({ createdAt: sort }).skip((page - 1) * ADMIN_PAGE_SIZE).limit(ADMIN_PAGE_SIZE).lean<IDomain[]>(),
    Domain.countDocuments(query),
    Domain.aggregate<{ _id: DomainSetupStatus; count: number }>([
      ...(opts.tenantId ? [{ $match: { tenantId: new ObjectId(opts.tenantId) } }] : []),
      { $group: { _id: "$setupStatus", count: { $sum: 1 } } },
    ]),
  ]);
  const tenantIds = docs.map((d) => d.tenantId);
  const [workspaces, subs] = await Promise.all([
    lookupWorkspaces(tenantIds),
    Subscription.find({ tenantId: { $in: tenantIds } }).select("tenantId plan").lean<Pick<ISubscription, "tenantId" | "plan">[]>(),
  ]);
  const planByTenant = new Map(subs.map((s) => [String(s.tenantId), s.plan]));

  const counts = Object.fromEntries(DOMAIN_SETUP_STATUSES.map((s) => [s, 0])) as Record<DomainSetupStatus, number>;
  for (const g of grouped) if (g._id in counts) counts[g._id] = g.count;

  const items: DomainRequestRow[] = docs.map((d) => {
    const plan = planByTenant.get(String(d.tenantId)) ?? "free";
    return {
      ...toDomainDTO(d),
      tenantId: String(d.tenantId),
      workspace: workspaceOf(workspaces, d.tenantId),
      plan,
      planAllowsDomain: PLANS[plan].entitlements.customDomain,
      createdAt: d.createdAt.toISOString(),
      lastCheckedAt: d.lastCheckedAt?.toISOString(),
      removalRequestedAt: d.removalRequestedAt?.toISOString(),
    };
  });
  return { items, counts, filter, page, pages: pageCount(total) };
}

async function loadDomain(id: string) {
  if (!isObjectId(id)) throw notFound("Domain");
  await connectDB();
  const doc = await Domain.findById(id);
  if (!doc) throw notFound("Domain");
  return doc;
}

function assertSetupStatus(doc: IDomain, allowed: DomainSetupStatus[], action: string) {
  const current = setupStatusOf(doc);
  if (!allowed.includes(current)) throw new AppError("CONFLICT", `Can't ${action} a domain that is ${current.replace("_", " ")}`);
}

/** Ops has added the hostname to the hosting project. It goes live as soon as DNS is verified too. */
export async function markDomainConfigured(admin: PlatformAdmin, id: string) {
  const doc = await loadDomain(id);
  assertSetupStatus(doc, ["requested"], "configure");
  doc.setupStatus = "configured";
  doc.setupUpdatedAt = new Date();
  await doc.save();
  await syncBrokerCustomDomain(doc);
  await auditAdmin(admin, String(doc.tenantId), "domain.configured", { type: "domain", id }, { hostname: doc.hostname });
  return { tenantId: String(doc.tenantId) };
}

/** Declines a request (e.g. a domain the broker can't plausibly own). The broker sees the reason. */
export async function rejectDomain(admin: PlatformAdmin, id: string, reason: string) {
  const doc = await loadDomain(id);
  assertSetupStatus(doc, ["requested"], "reject");
  doc.setupStatus = "rejected";
  doc.rejectionReason = reason;
  doc.setupUpdatedAt = new Date();
  await doc.save();
  await syncBrokerCustomDomain(doc);
  await auditAdmin(admin, String(doc.tenantId), "domain.rejected", { type: "domain", id }, { hostname: doc.hostname, reason });
  return { tenantId: String(doc.tenantId) };
}

export async function reopenDomain(admin: PlatformAdmin, id: string) {
  const doc = await loadDomain(id);
  assertSetupStatus(doc, ["rejected"], "reopen");
  doc.setupStatus = "requested";
  doc.rejectionReason = undefined;
  doc.setupUpdatedAt = new Date();
  await doc.save();
  await auditAdmin(admin, String(doc.tenantId), "domain.reopened", { type: "domain", id }, { hostname: doc.hostname });
  return { tenantId: String(doc.tenantId) };
}

export async function recheckDomainDns(id: string) {
  const doc = await loadDomain(id);
  assertSetupStatus(doc, ["requested", "configured"], "check");
  const verified = await checkDomainDns(doc);
  return { tenantId: String(doc.tenantId), verified };
}

/** Takes a live domain away from the workspace (e.g. after a downgrade). Ops then detaches it from hosting. */
export async function disconnectDomain(admin: PlatformAdmin, id: string, reason: string) {
  const doc = await loadDomain(id);
  assertSetupStatus(doc, ["configured"], "disconnect");
  await detachDomain(doc);
  await auditAdmin(admin, String(doc.tenantId), "domain.disconnected", { type: "domain", id }, { hostname: doc.hostname, reason });
  return { tenantId: String(doc.tenantId) };
}

/** Ops has removed the hostname from the hosting project; the tombstone can go. */
export async function completeDomainRemoval(admin: PlatformAdmin, id: string) {
  const doc = await loadDomain(id);
  assertSetupStatus(doc, ["removal_requested"], "complete removal of");
  await doc.deleteOne();
  await auditAdmin(admin, String(doc.tenantId), "domain.removal_completed", { type: "domain", id }, { hostname: doc.hostname });
  return { tenantId: String(doc.tenantId) };
}
