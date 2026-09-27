import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import type { HydratedDocument } from "mongoose";
import { getRootDomain } from "@/lib/config/site";
import type { DomainSetupStatus } from "@/lib/domain/billing";
import type { DomainInput } from "@/lib/validation/settings";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { env } from "@/server/lib/env";
import { AppError, notFound } from "@/server/lib/errors";
import { Broker, Domain, isObjectId, type IBroker, type IDomain } from "@/server/models";
import { audit } from "@/server/services/audit/audit.service";
import { getEntitlements } from "@/server/services/subscriptions/subscription.service";

export interface DomainDTO {
  id: string;
  hostname: string;
  status: IDomain["status"];
  setupStatus: DomainSetupStatus;
  rejectionReason?: string;
  verificationRecord: { type: "TXT"; name: string; value: string };
  routingRecord: { type: "CNAME"; name: string; value: string };
  verifiedAt?: string;
}

const TXT_PREFIX = "_propflow";

/** Domains created before the setup workflow existed: verified ones were already live on hosting. */
export function setupStatusOf(doc: Pick<IDomain, "setupStatus" | "status">): DomainSetupStatus {
  return doc.setupStatus ?? (doc.status === "verified" ? "configured" : "requested");
}

/** A domain serves the broker's site only once DNS is verified and ops has attached it to hosting. */
export function isDomainLive(doc: Pick<IDomain, "setupStatus" | "status">): boolean {
  return doc.status === "verified" && setupStatusOf(doc) === "configured";
}

/** Tombstones kept only so ops can detach the domain from hosting; the broker no longer sees them. */
const VISIBLE_TO_BROKER = { setupStatus: { $ne: "removal_requested" as const } };

export function toDomainDTO(doc: IDomain): DomainDTO {
  return {
    id: String(doc._id),
    hostname: doc.hostname,
    status: doc.status,
    setupStatus: setupStatusOf(doc),
    rejectionReason: doc.rejectionReason ?? undefined,
    verificationRecord: { type: "TXT", name: `${TXT_PREFIX}.${doc.hostname}`, value: `propflow-verify=${doc.verificationToken}` },
    // Where the broker points their domain: the hosting provider's CNAME target (Vercel by default).
    routingRecord: { type: "CNAME", name: doc.hostname, value: env().CUSTOM_DOMAIN_CNAME_TARGET },
    verifiedAt: doc.verifiedAt?.toISOString(),
  };
}

export async function listDomains(ctx: TenantContext): Promise<DomainDTO[]> {
  await connectDB();
  const docs = await Domain.find({ tenantId: ctx.tenantId, ...VISIBLE_TO_BROKER }).sort({ createdAt: 1 }).lean<IDomain[]>();
  return docs.map(toDomainDTO);
}

/** Points the broker's links at the domain when it's live, and away from it when it isn't. */
export async function syncBrokerCustomDomain(doc: Pick<IDomain, "tenantId" | "hostname" | "setupStatus" | "status">) {
  if (isDomainLive(doc)) await Broker.updateOne({ tenantId: doc.tenantId }, { $set: { customDomain: doc.hostname } });
  else await Broker.updateOne({ tenantId: doc.tenantId, customDomain: doc.hostname }, { $unset: { customDomain: 1 } });
}

/** Looks up the `_propflow` TXT record and stores the result. Shared by broker Verify and admin re-checks. */
export async function checkDomainDns(doc: HydratedDocument<IDomain>): Promise<boolean> {
  let records: string[][] = [];
  try {
    records = await resolveTxt(`${TXT_PREFIX}.${doc.hostname}`);
  } catch {
    records = [];
  }
  const expected = `propflow-verify=${doc.verificationToken}`;
  const verified = records.some((chunks) => chunks.join("") === expected);
  doc.status = verified ? "verified" : "failed";
  doc.lastCheckedAt = new Date();
  if (verified) doc.verifiedAt ??= new Date();
  await doc.save();
  await syncBrokerCustomDomain(doc);
  return verified;
}

/**
 * Disconnects a domain from its workspace. One that ops attached to hosting is kept as a
 * `removal_requested` tombstone so they know to detach it there too.
 */
export async function detachDomain(doc: HydratedDocument<IDomain>) {
  if (setupStatusOf(doc) === "configured") {
    doc.setupStatus = "removal_requested";
    doc.removalRequestedAt = new Date();
    doc.setupUpdatedAt = new Date();
    await doc.save();
  } else {
    await doc.deleteOne();
  }
  await Broker.updateOne({ tenantId: doc.tenantId, customDomain: doc.hostname }, { $unset: { customDomain: 1 } });
}

export async function addDomain(ctx: TenantContext, input: DomainInput): Promise<DomainDTO> {
  assertCan(ctx, "domain:manage");
  const { customDomain } = await getEntitlements(ctx.tenantId);
  if (!customDomain) throw new AppError("LIMIT_EXCEEDED", "Custom domains are available on the Business plan");
  const root = getRootDomain();
  if (root && (input.hostname === root || input.hostname.endsWith(`.${root}`))) {
    throw new AppError("VALIDATION", "Use your own domain", { hostname: "Use a domain you own" });
  }
  await connectDB();
  const existing = await Domain.findOne({ hostname: input.hostname });
  if (existing && existing.setupStatus !== "removal_requested") {
    throw new AppError("CONFLICT", "This domain is already connected", { hostname: "This domain is already connected" });
  }
  // A recently removed domain may still be attached to our hosting: reuse that instead of asking ops to redo it.
  if (existing) await existing.deleteOne();
  const doc = await Domain.create({
    tenantId: ctx.tenantId,
    hostname: input.hostname,
    verificationToken: randomBytes(12).toString("hex"),
    setupStatus: existing ? "configured" : "requested",
  });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "domain.added", { type: "domain", id: String(doc._id) }, { hostname: input.hostname });
  return toDomainDTO(doc);
}

export async function verifyDomain(ctx: TenantContext, id: string): Promise<DomainDTO> {
  assertCan(ctx, "domain:manage");
  if (!isObjectId(id)) throw notFound("Domain");
  await connectDB();
  const doc = await Domain.findOne({ _id: id, tenantId: ctx.tenantId, ...VISIBLE_TO_BROKER });
  if (!doc) throw notFound("Domain");
  if (doc.setupStatus === "rejected") throw new AppError("FORBIDDEN", "This domain request was declined. Remove it or contact support.");
  const verified = await checkDomainDns(doc);
  if (verified) {
    await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "domain.verified", { type: "domain", id }, { hostname: doc.hostname });
  }
  return toDomainDTO(doc);
}

export async function removeDomain(ctx: TenantContext, id: string) {
  assertCan(ctx, "domain:manage");
  if (!isObjectId(id)) throw notFound("Domain");
  await connectDB();
  const doc = await Domain.findOne({ _id: id, tenantId: ctx.tenantId, ...VISIBLE_TO_BROKER });
  if (!doc) throw notFound("Domain");
  await detachDomain(doc);
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "domain.removed", { type: "domain", id }, { hostname: doc.hostname });
}

/** Used by the proxy: maps a verified custom hostname to its broker slug. */
export async function resolveCustomDomain(hostname: string): Promise<string | null> {
  await connectDB();
  const domain = await Domain.findOne({ hostname: hostname.toLowerCase(), status: "verified", setupStatus: { $nin: ["rejected", "removal_requested"] } })
    .select("tenantId")
    .lean<Pick<IDomain, "tenantId">>();
  if (!domain) return null;
  const broker = await Broker.findOne({ tenantId: domain.tenantId }).select("slug").lean<Pick<IBroker, "slug">>();
  return broker?.slug ?? null;
}
