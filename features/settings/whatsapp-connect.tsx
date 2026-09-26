"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { CheckCircle2, Copy, Loader2, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { formatPhone } from "@/lib/phone";
import { buildWhatsAppUrl } from "@/lib/whatsapp-link";
import { copyText } from "@/features/properties/share-menu";
import { disconnectNumberAction } from "@/features/whatsapp/actions";

export function WhatsAppConnect({ businessNumber, connectCode, senderNumbers }: { businessNumber: string; connectCode: string; senderNumbers: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const message = `CONNECT ${connectCode}`;
  const connected = senderNumbers.length > 0;

  // Watch for the webhook to link the number, then show the connected state.
  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [connected, router]);

  return (
    <div className="space-y-6">
      {connected && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-emerald-500" /> WhatsApp connected
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Send property details and photos from these numbers to {formatPhone(businessNumber)}.</p>
          <ul className="mt-4 divide-y rounded-xl border">
            {senderNumbers.map((n) => (
              <li key={n} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="size-4 text-muted-foreground" /> {formatPhone(n)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await disconnectNumberAction(n);
                      if (!result.ok) return void toast.error(result.error);
                      toast.success("Number disconnected");
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-3.5" /> Disconnect
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-semibold">{connected ? "Connect another number" : "Connect your WhatsApp"}</h2>
        <ol className="mt-4 space-y-5">
          <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
            <div className="text-sm">
              <p className="font-medium">Save the PropFlow number in your phone</p>
              <p className="mt-1 font-mono text-base">{formatPhone(businessNumber)}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">Send this code from the WhatsApp number you use for work</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg border bg-surface px-3 py-2 font-mono text-base font-semibold tracking-wider">{message}</code>
                <Button size="sm" variant="outline" onClick={async () => (await copyText(message)) && toast.success("Copied")}>
                  <Copy className="size-3.5" /> Copy
                </Button>
                <Button asChild size="sm" className="bg-whatsapp text-white hover:bg-whatsapp/90">
                  <a href={buildWhatsAppUrl(businessNumber, message)} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="size-3.5" /> Open WhatsApp
                  </a>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">The code expires in 30 minutes. Refresh this page for a new one.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span>
            <div className="text-sm">
              <p className="font-medium">We&apos;ll confirm on WhatsApp</p>
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                {!connected && <Loader2 className="size-3.5 animate-spin" />} {connected ? "Done — you're all set." : "Waiting for your message…"}
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
