import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { siteConfig } from "@/lib/config/site";
import { getSession } from "@/server/auth/session";
import { isTenantSuspended } from "@/server/services/tenants/tenant-status.service";

export const metadata: Metadata = { title: "Workspace suspended", robots: { index: false, follow: false } };

/** Where members of a suspended workspace land instead of the dashboard. */
export default async function SuspendedPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.tenantId || !(await isTenantSuspended(session.user.tenantId))) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-5 py-6 sm:px-10">
      <Logo />
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-soft sm:p-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <PauseCircle className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Your workspace is suspended</h1>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            Your dashboard, public website and WhatsApp property intake are paused. Your properties, leads and settings are safe and will be restored when the workspace is reactivated.
          </p>
          <p className="mt-4 text-sm">
            Contact{" "}
            <a href={`mailto:${siteConfig.supportEmail}`} className="font-medium underline underline-offset-4">
              {siteConfig.supportEmail}
            </a>{" "}
            to resolve this.
          </p>
          <form action={signOutAction} className="mt-6">
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
