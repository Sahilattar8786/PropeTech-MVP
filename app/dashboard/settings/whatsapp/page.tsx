import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, Webhook } from "lucide-react";
import { WhatsAppConnect } from "@/features/settings/whatsapp-connect";
import { getAppUrl } from "@/lib/config/site";
import { requireTenantContext } from "@/server/auth/session";
import { env } from "@/server/lib/env";
import { getWhatsAppSettings } from "@/server/services/whatsapp/connection.service";

export const metadata: Metadata = { title: "WhatsApp settings" };

export default async function WhatsAppSettingsPage() {
  const ctx = await requireTenantContext();
  const settings = await getWhatsAppSettings(ctx);
  const e = env();
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_300px]">
      <WhatsAppConnect businessNumber={settings.businessNumber} connectCode={settings.connectCode} senderNumbers={settings.senderNumbers} />
      <aside className="space-y-4">
        {settings.provider === "sandbox" ? (
          <div className="rounded-2xl border border-dashed border-brand/30 bg-brand-soft/40 p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <FlaskConical className="size-4 text-brand" /> Sandbox mode
            </p>
            <p className="mt-2 text-muted-foreground">WhatsApp Business credentials aren&apos;t configured. Use the simulator in the <Link href="/dashboard/whatsapp" className="font-medium text-foreground underline">WhatsApp inbox</Link> to send the connect code and test properties.</p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-5 text-sm shadow-soft">
            <p className="font-semibold">Meta WhatsApp Cloud API</p>
            <p className="mt-2 text-muted-foreground">Connected to business number {settings.businessNumber}.</p>
          </div>
        )}
        {ctx.role !== "agent" && (
          <div className="rounded-2xl border bg-card p-5 text-sm shadow-soft">
            <p className="flex items-center gap-2 font-semibold">
              <Webhook className="size-4 text-muted-foreground" /> Webhook
            </p>
            <dl className="mt-3 space-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Callback URL</dt>
                <dd className="font-mono break-all">{getAppUrl()}/api/webhooks/whatsapp</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Verify token</dt>
                <dd>{e.WHATSAPP_VERIFY_TOKEN ? "Configured" : "Not set (WHATSAPP_VERIFY_TOKEN)"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Signature verification</dt>
                <dd>{e.WHATSAPP_APP_SECRET ? "Enabled" : "Disabled (set WHATSAPP_APP_SECRET)"}</dd>
              </div>
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
