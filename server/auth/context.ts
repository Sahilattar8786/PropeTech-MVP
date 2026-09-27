import type { UserRole } from "@/server/models/user";

/** Identity + tenant for every authenticated service call. Services must scope queries by `tenantId`. */
export interface TenantContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
}

/** PropFlow staff (User.platformRole or ADMIN_EMAILS). Platform-wide — admin services are not tenant-scoped. */
export interface PlatformAdmin {
  userId: string;
  email: string;
  name: string;
}
