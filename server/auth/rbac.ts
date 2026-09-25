import type { UserRole } from "@/server/models/user";
import { forbidden } from "@/server/lib/errors";

export type Permission =
  | "property:read"
  | "property:write"
  | "property:publish"
  | "property:delete"
  | "collection:write"
  | "lead:read"
  | "lead:write"
  | "whatsapp:read"
  | "settings:write"
  | "domain:manage"
  | "billing:manage"
  | "analytics:read";

const ALL: Permission[] = [
  "property:read",
  "property:write",
  "property:publish",
  "property:delete",
  "collection:write",
  "lead:read",
  "lead:write",
  "whatsapp:read",
  "settings:write",
  "domain:manage",
  "billing:manage",
  "analytics:read",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "billing:manage"),
  agent: ["property:read", "property:write", "property:publish", "collection:write", "lead:read", "lead:write", "whatsapp:read"],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertCan(ctx: { role: UserRole }, permission: Permission) {
  if (!can(ctx.role, permission)) throw forbidden();
}
