import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { AppError, forbidden } from "@/server/lib/errors";
import { isTenantSuspended } from "@/server/services/tenants/tenant-status.service";
import { getAuthUser } from "@/server/services/tenants/registration.service";
import type { PlatformAdmin, TenantContext } from "./context";

export const getSession = cache(async () => auth());

/** For pages and layouts: redirects unauthenticated users to /login and tenant-less users to /onboarding. */
export async function requireTenantContext(): Promise<TenantContext> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.tenantId) redirect("/onboarding");
  if (await isTenantSuspended(session.user.tenantId)) redirect("/suspended");
  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}

/** For Server Actions and Route Handlers: throws instead of redirecting. */
export async function getTenantContextOrThrow(): Promise<TenantContext> {
  const session = await getSession();
  if (!session?.user?.id || !session.user.tenantId) throw new AppError("UNAUTHORIZED", "Please sign in to continue");
  if (await isTenantSuspended(session.user.tenantId)) throw forbidden("This workspace is suspended. Please contact support.");
  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}

/**
 * The session's platformRole is only refreshed at sign-in, so it's re-checked against the
 * database: revoking access takes effect immediately rather than when the JWT expires.
 */
const loadPlatformAdmin = cache(async (userId: string): Promise<PlatformAdmin | null> => {
  const user = await getAuthUser(userId);
  return user?.platformRole === "admin" ? { userId: user.id, email: user.email, name: user.name } : null;
});

/** For admin pages and layouts. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");
  const admin = await loadPlatformAdmin(session.user.id);
  if (!admin) redirect("/dashboard");
  return admin;
}

/** For admin Server Actions: throws instead of redirecting. */
export async function getPlatformAdminOrThrow(): Promise<PlatformAdmin> {
  const session = await getSession();
  if (!session?.user?.id) throw new AppError("UNAUTHORIZED", "Please sign in to continue");
  const admin = await loadPlatformAdmin(session.user.id);
  if (!admin) throw forbidden();
  return admin;
}
