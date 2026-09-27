import type { PlatformAdmin } from "@/server/auth/context";
import { Broker, Tenant, type IBroker, type ITenant, type ObjectId } from "@/server/models";
import { audit } from "@/server/services/audit/audit.service";

export const ADMIN_PAGE_SIZE = 25;

/**
 * Admin changes are written to the target workspace's audit trail as `admin.*` actions,
 * with the admin's email kept alongside so the entry stays readable if the user is removed.
 */
export function auditAdmin(
  admin: PlatformAdmin,
  tenantId: string,
  action: string,
  entity: { type: string; id?: string },
  metadata?: Record<string, unknown>,
) {
  return audit({ tenantId, userId: admin.userId }, `admin.${action}`, entity, { ...metadata, adminEmail: admin.email });
}

export interface WorkspaceRef {
  name: string;
  slug?: string;
  suspended: boolean;
}

/** Workspace name/slug for rows that only carry a tenantId. */
export async function lookupWorkspaces(tenantIds: (ObjectId | string)[]): Promise<Map<string, WorkspaceRef>> {
  const ids = [...new Set(tenantIds.map(String))];
  if (ids.length === 0) return new Map();
  const [tenants, brokers] = await Promise.all([
    Tenant.find({ _id: { $in: ids } }).select("name status").lean<Pick<ITenant, "_id" | "name" | "status">[]>(),
    Broker.find({ tenantId: { $in: ids } }).select("tenantId slug").lean<Pick<IBroker, "tenantId" | "slug">[]>(),
  ]);
  const slugs = new Map(brokers.map((b) => [String(b.tenantId), b.slug]));
  return new Map(tenants.map((t) => [String(t._id), { name: t.name, slug: slugs.get(String(t._id)), suspended: t.status === "suspended" }]));
}

export function workspaceOf(map: Map<string, WorkspaceRef>, tenantId: ObjectId | string): WorkspaceRef {
  return map.get(String(tenantId)) ?? { name: "Deleted workspace", suspended: false };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
}
