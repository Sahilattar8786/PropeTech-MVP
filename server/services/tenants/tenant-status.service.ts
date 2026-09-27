import { cache } from "react";
import { connectDB } from "@/server/db/connect";
import { Tenant } from "@/server/models";

/**
 * Suspended workspaces (set by platform admins) lose dashboard access, their public site
 * and WhatsApp intake. Request-deduplicated because layouts and pages both check it.
 */
export const isTenantSuspended = cache(async (tenantId: string): Promise<boolean> => {
  await connectDB();
  return Boolean(await Tenant.exists({ _id: tenantId, status: "suspended" }));
});
