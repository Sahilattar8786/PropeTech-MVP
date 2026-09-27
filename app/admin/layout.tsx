import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/shell";
import { getSession, requirePlatformAdmin } from "@/server/auth/session";
import { getAdminNavCounts } from "@/server/services/admin/admin.service";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · PropFlow Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requirePlatformAdmin();
  const [session, counts] = await Promise.all([getSession(), getAdminNavCounts()]);
  return (
    <AdminShell admin={admin} counts={counts} hasWorkspace={Boolean(session?.user?.tenantId)}>
      {children}
    </AdminShell>
  );
}
