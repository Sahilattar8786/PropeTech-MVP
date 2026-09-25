import type { UserRole } from "@/server/models/user";

/** Identity + tenant for every authenticated service call. Services must scope queries by `tenantId`. */
export interface TenantContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
}
