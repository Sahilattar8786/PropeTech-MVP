import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { getRootDomain } from "@/lib/config/site";
import type { DomainInput } from "@/lib/validation/settings";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { AppError, notFound } from "@/server/lib/errors";
import { Broker, Domain, isObjectId, type IBroker, type IDomain } from "@/server/models";
import { audit } from "@/server/services/audit/audit.service";
import { getEntitlements } from "@/server/services/subscriptions/subscription.service";

export interface DomainDTO {
  id: string;
  hostname: string;
  status: IDomain["status"];
  verificationRecord: { type: "TXT"; name: string; value: string };
  routingRecord: { type: "CNAME"; name: string; value: string };
  verifiedAt?: string;
}

const TXT_PREFIX = "_propflow";

function toDTO(doc: IDomain): DomainDTO {
  const root = getRootDomain() ?? "propflow.in";
  return {
    id: String(doc._id),
    hostname: doc.hostname,
    status: doc.status,
    verificationRecord: { type: "TXT", name: `${TXT_PREFIX}.${doc.hostname}`, value: `propflow-verify=${doc.verificationToken}` },
    routingRecord: { type: "CNAME", name: doc.hostname, value: `sites.${root}` },
    verifiedAt: doc.verifiedAt?.toISOString(),
  };
}

export async function listDomains(ctx: TenantContext): Promise<DomainDTO[]> {
  await connectDB();
  const docs = await Domain.find({ tenantId: ctx.tenantId }).sort({ createdAt: 1 }).lean<IDomain[]>();
  return docs.map(toDTO);
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
  if (await Domain.exists({ hostname: input.hostname })) {
    throw new AppError("CONFLICT", "This domain is already connected", { hostname: "This domain is already connected" });
  }
  const doc = await Domain.create({ tenantId: ctx.tenantId, hostname: input.hostname, verificationToken: randomBytes(12).toString("hex") });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "domain.added", { type: "domain", id: String(doc._id) }, { hostname: input.hostname });
  return toDTO(doc);
}

export async function verifyDomain(ctx: TenantContext, id: string): Promise<DomainDTO> {
  assertCan(ctx, "domain:manage");
  if (!isObjectId(id)) throw notFound("Domain");
  await connectDB();
  const doc = await Domain.findOne({ _id: id, tenantId: ctx.tenantId });
  if (!doc) throw notFound("Domain");
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
  if (verified) doc.verifiedAt = new Date();
  await doc.save();
  if (verified) {
    await Broker.updateOne({ tenantId: ctx.tenantId }, { $set: { customDomain: doc.hostname } });
    await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "domain.verified", { type: "domain", id }, { hostname: doc.hostname });
  }
  return toDTO(doc);
}

export async function removeDomain(ctx: TenantContext, id: string) {
  assertCan(ctx, "domain:manage");
  if (!isObjectId(id)) throw notFound("Domain");
  await connectDB();
  const doc = await Domain.findOneAndDelete({ _id: id, tenantId: ctx.tenantId });
  if (!doc) throw notFound("Domain");
  await Broker.updateOne({ tenantId: ctx.tenantId, customDomain: doc.hostname }, { $unset: { customDomain: 1 } });
  await audit({ tenantId: ctx.tenantId, userId: ctx.userId }, "domain.removed", { type: "domain", id }, { hostname: doc.hostname });
}

/** Used by the proxy: maps a verified custom hostname to its broker slug. */
export async function resolveCustomDomain(hostname: string): Promise<string | null> {
  await connectDB();
  const domain = await Domain.findOne({ hostname: hostname.toLowerCase(), status: "verified" }).select("tenantId").lean<Pick<IDomain, "tenantId">>();
  if (!domain) return null;
  const broker = await Broker.findOne({ tenantId: domain.tenantId }).select("slug").lean<Pick<IBroker, "slug">>();
  return broker?.slug ?? null;
}
