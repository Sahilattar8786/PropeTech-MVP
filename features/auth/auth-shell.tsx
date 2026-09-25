import { Check, Sparkles } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { PropertyIllustration } from "@/components/shared/property-illustration";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";

/** Split layout: form on the left, calm product story on the right (desktop only). */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_minmax(0,640px)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#f3f5f2] lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,var(--brand-soft),transparent)]" />
        <div className="relative mx-auto w-full max-w-sm">
          <div className="ml-6 w-64 rounded-2xl rounded-tr-sm bg-whatsapp-bubble p-3 text-[13px] leading-snug shadow-soft">
            <p className="font-semibold">New Property</p>
            <p>3 BHK flat in Whitefield</p>
            <p>1800 sqft · ₹1.5 Cr</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-500">
              <WhatsAppIcon className="size-3 text-whatsapp" /> 10:42
            </p>
          </div>
          <div className="my-3 ml-24 inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold text-brand shadow-soft">
            <Sparkles className="size-3.5" /> AI organised
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-lifted">
            <div className="relative aspect-[16/9]">
              <PropertyIllustration variant="tower" />
            </div>
            <div className="p-4">
              <p className="text-lg font-semibold">₹1.50 Cr</p>
              <p className="text-sm font-medium">Premium 3 BHK Apartment in Whitefield</p>
              <p className="text-xs text-muted-foreground">Whitefield, Bangalore · 1,800 sq.ft.</p>
            </div>
          </div>
          <ul className="mt-8 space-y-2.5 text-sm text-muted-foreground">
            {["Send properties on WhatsApp", "Review AI drafts before anything goes live", "Share listings and get WhatsApp leads"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-brand" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
