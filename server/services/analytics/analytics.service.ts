import type { TenantContext } from "@/server/auth/context";
import { assertCan } from "@/server/auth/rbac";
import { connectDB } from "@/server/db/connect";
import { AnalyticsEvent, Lead, ObjectId, Property, type IProperty } from "@/server/models";
import { toPropertyDTO } from "@/server/services/properties/property.mapper";

export interface DailyPoint {
  date: string;
  views: number;
  clicks: number;
  leads: number;
}

/** Reporting over AnalyticsEvent + Lead for the broker's analytics dashboard. */
export async function getAnalyticsOverview(ctx: TenantContext, days = 30) {
  assertCan(ctx, "analytics:read");
  await connectDB();
  const tenantId = new ObjectId(ctx.tenantId);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [events, leads, topProperties, sources] = await Promise.all([
    AnalyticsEvent.aggregate<{ _id: { day: string; name: string }; count: number }>([
      { $match: { tenantId, createdAt: { $gte: since }, name: { $in: ["property_viewed", "whatsapp_clicked"] } } },
      { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, name: "$name" }, count: { $sum: 1 } } },
    ]),
    Lead.aggregate<{ _id: string; count: number }>([
      { $match: { tenantId, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, count: { $sum: 1 } } },
    ]),
    Property.find({ tenantId, status: { $ne: "draft" } }).sort({ views: -1 }).limit(8).lean<IProperty[]>(),
    AnalyticsEvent.aggregate<{ _id: string; count: number }>([
      { $match: { tenantId, createdAt: { $gte: since }, name: "whatsapp_message_received" } },
      { $group: { _id: "$name", count: { $sum: 1 } } },
    ]),
  ]);

  const series: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    series.push({
      date: key,
      views: events.find((e) => e._id.day === key && e._id.name === "property_viewed")?.count ?? 0,
      clicks: events.find((e) => e._id.day === key && e._id.name === "whatsapp_clicked")?.count ?? 0,
      leads: leads.find((l) => l._id === key)?.count ?? 0,
    });
  }
  const totals = series.reduce((acc, p) => ({ views: acc.views + p.views, clicks: acc.clicks + p.clicks, leads: acc.leads + p.leads }), { views: 0, clicks: 0, leads: 0 });
  return {
    series,
    totals: { ...totals, whatsappMessages: sources[0]?.count ?? 0, clickRate: totals.views ? totals.clicks / totals.views : 0 },
    topProperties: topProperties.map(toPropertyDTO),
  };
}
