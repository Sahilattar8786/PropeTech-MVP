import { connectDB } from "@/server/db/connect";
import { Broker, Lead, Property, Subscription, Tenant, User, type IBroker, type ISubscription, type ITenant } from "@/server/models";

/** Platform-wide overview for PropFlow staff (ADMIN_EMAILS). Read-only. */
export async function getPlatformOverview() {
  await connectDB();
  const [tenants, users, properties, published, leads] = await Promise.all([
    Tenant.countDocuments(),
    User.countDocuments(),
    Property.countDocuments(),
    Property.countDocuments({ status: { $ne: "draft" } }),
    Lead.countDocuments(),
  ]);
  const recent = await Tenant.find().sort({ createdAt: -1 }).limit(25).lean<ITenant[]>();
  const ids = recent.map((t) => t._id);
  const [brokers, subs, counts] = await Promise.all([
    Broker.find({ tenantId: { $in: ids } }).select("tenantId slug businessName city").lean<IBroker[]>(),
    Subscription.find({ tenantId: { $in: ids } }).lean<ISubscription[]>(),
    Property.aggregate<{ _id: unknown; count: number }>([{ $match: { tenantId: { $in: ids } } }, { $group: { _id: "$tenantId", count: { $sum: 1 } } }]),
  ]);
  const byTenant = <T extends { tenantId: unknown }>(rows: T[]) => new Map(rows.map((r) => [String(r.tenantId), r]));
  const brokerMap = byTenant(brokers);
  const subMap = byTenant(subs);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return {
    totals: { tenants, users, properties, published, leads },
    tenants: recent.map((t) => ({
      id: String(t._id),
      name: t.name,
      slug: brokerMap.get(String(t._id))?.slug,
      city: brokerMap.get(String(t._id))?.city,
      plan: subMap.get(String(t._id))?.plan ?? "free",
      status: subMap.get(String(t._id))?.status ?? "active",
      properties: countMap.get(String(t._id)) ?? 0,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
