import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { AppError } from "@/server/lib/errors";
import type { TenantContext } from "./context";

export const getSession = cache(async () => auth());

/** For pages and layouts: redirects unauthenticated users to /login and tenant-less users to /onboarding. */
export async function requireTenantContext(): Promise<TenantContext> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.tenantId) redirect("/onboarding");
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
  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}

export async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.platformRole !== "admin") redirect("/dashboard");
  return session.user;
}
