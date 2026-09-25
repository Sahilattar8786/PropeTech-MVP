import { createHash } from "node:crypto";
import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { notFound } from "@/server/lib/errors";
import { isObjectId, Lead, ObjectId, Property, type ILead, type IProperty, type LeadSource, type LeadStatus } from "@/server/models";
import { trackEvent } from "@/server/services/analytics/track";
import { configurationLabel, locationLabel, priceLabel } from "@/lib/format";
import { toPropertyDTO } from "@/server/services/properties/property.mapper";

export interface LeadDTO {
  id: string;
  propertyId?: string;
  propertyTitle?: string;
  propertyCode?: string;
  interest: string;
  source: LeadSource;
  sourceUrl?: string;
  status: LeadStatus;
  notes?: string;
  createdAt: string;
}

const DEDUPE_WINDOW_MS = 30 * 60_000;

export function visitorHash(ip: string, userAgent: string): string {
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

/**
 * Customer clicked "I'm Interested — WhatsApp Broker". Records the click and creates
 * a lead (de-duplicated per visitor + property for 30 minutes).
 */
export async function recordWhatsAppClick(input: { propertyId: string; sourceUrl?: string; visitor: string; source?: LeadSource }) {
  if (!isObjectId(input.propertyId)) return null;
  await connectDB();
  const property = await Property.findOneAndUpdate(
    { _id: input.propertyId, status: { $in: ["active", "reserved"] } },
    { $inc: { whatsappClicks: 1 } },
    { new: true },
  ).lean<IProperty>();
  if (!property) return null;
  const tenantId = String(property.tenantId);
  trackEvent("whatsapp_clicked", { tenantId, propertyId: input.propertyId, properties: { sourceUrl: input.sourceUrl } });

  const recent = await Lead.exists({
    tenantId,
    propertyId: property._id,
    visitorHash: input.visitor,
    createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
  });
  if (recent) return null;

  const dto = toPropertyDTO(property);
  const interest = [configurationLabel(dto), locationLabel(dto.location, { short: true }), priceLabel(dto)].filter(Boolean).join(" · ");
  const lead = await Lead.create({
    tenantId,
    propertyId: property._id,
    source: input.source ?? "property_page",
    sourceUrl: input.sourceUrl?.slice(0, 500),
    interest,
    visitorHash: input.visitor,
  });
  trackEvent("lead_created", { tenantId, propertyId: input.propertyId, properties: { leadId: String(lead._id) } });
  return String(lead._id);
}

export async function recordPropertyView(propertyId: string) {
  if (!isObjectId(propertyId)) return;
  await connectDB();
  const property = await Property.findOneAndUpdate(
    { _id: propertyId, status: { $in: ["active", "reserved"] } },
    { $inc: { views: 1 } },
    { projection: { tenantId: 1 } },
  ).lean<Pick<IProperty, "tenantId">>();
  if (property) trackEvent("property_viewed", { tenantId: String(property.tenantId), propertyId });
}

export async function listLeads(ctx: TenantContext, opts: { status?: LeadStatus; page?: number } = {}) {
  assertCan(ctx, "lead:read");
  await connectDB();
  const pageSize = 25;
  const page = opts.page ?? 1;
  const query: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (opts.status) query.status = opts.status;
  const [leads, total, counts] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean<ILead[]>(),
    Lead.countDocuments(query),
    Lead.aggregate<{ _id: LeadStatus; count: number }>([{ $match: { tenantId: new ObjectId(ctx.tenantId) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const properties = await Property.find({ tenantId: ctx.tenantId, _id: { $in: leads.flatMap((l) => (l.propertyId ? [l.propertyId] : [])) } })
    .select("title propertyId")
    .lean<Pick<IProperty, "_id" | "title" | "propertyId">[]>();
  const byId = new Map(properties.map((p) => [String(p._id), p]));
  const items: LeadDTO[] = leads.map((l) => {
    const p = l.propertyId ? byId.get(String(l.propertyId)) : undefined;
    return {
      id: String(l._id),
      propertyId: l.propertyId ? String(l.propertyId) : undefined,
      propertyTitle: p?.title,
      propertyCode: p?.propertyId,
      interest: l.interest,
      source: l.source,
      sourceUrl: l.sourceUrl,
      status: l.status,
      notes: l.notes,
      createdAt: l.createdAt.toISOString(),
    };
  });
  const statusCounts = Object.fromEntries(counts.map((c) => [c._id, c.count])) as Partial<Record<LeadStatus, number>>;
  return { items, total, page, pageSize, statusCounts };
}

export async function updateLeadStatus(ctx: TenantContext, leadId: string, status: LeadStatus) {
  assertCan(ctx, "lead:write");
  if (!isObjectId(leadId)) throw notFound("Lead");
  await connectDB();
  const result = await Lead.updateOne({ _id: leadId, tenantId: ctx.tenantId }, { $set: { status } });
  if (result.matchedCount === 0) throw notFound("Lead");
}
