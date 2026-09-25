import { BadgeCheck, CheckCheck, MapPin, Maximize2, BedDouble, Car, ChevronLeft, MoreVertical, Phone } from "lucide-react";
import { PropertyIllustration, type IllustrationVariant } from "@/components/shared/property-illustration";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { LogoMark } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { sampleBroker, sampleListing, sampleMessage } from "./content";

/* Static, presentational mockups of the product used across the landing page. */

export function SectionHeading({ eyebrow, title, description, align = "center" }: { eyebrow?: string; title: string; description?: string; align?: "center" | "left" }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 text-sm font-semibold text-brand">{eyebrow}</p>}
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg text-pretty">{description}</p>}
    </div>
  );
}

export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-[2.2rem] border border-zinc-900/10 bg-zinc-900 p-2 shadow-lifted", className)}>
      <div className="overflow-hidden rounded-[1.8rem] bg-whatsapp-chat">{children}</div>
    </div>
  );
}

export function ChatHeader({ title = "PropFlow", subtitle = "Business account" }: { title?: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-white">
      <ChevronLeft className="size-4 opacity-80" />
      <div className="flex size-7 items-center justify-center rounded-full bg-white/95">
        <LogoMark className="size-5" />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="flex items-center gap-1 text-[13px] font-semibold">
          {title} <BadgeCheck className="size-3.5 text-[#25d366]" />
        </p>
        <p className="text-[10px] opacity-75">{subtitle}</p>
      </div>
      <Phone className="size-4 opacity-80" />
      <MoreVertical className="size-4 opacity-80" />
    </div>
  );
}

export function BrokerMessageBubble({ compact = false }: { compact?: boolean }) {
  const variants: IllustrationVariant[] = ["tower", "interior", "courtyard", "interior"];
  return (
    <div className="ml-auto w-[88%] rounded-xl rounded-tr-sm bg-whatsapp-bubble p-1.5 shadow-sm">
      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
        {variants.slice(0, compact ? 2 : 4).map((v, i) => (
          <div key={i} className="relative aspect-[4/3] overflow-hidden">
            <PropertyIllustration variant={v} tone={i} />
            {compact && i === 1 && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">+2</div>}
          </div>
        ))}
      </div>
      <div className="px-1.5 pt-1.5 pb-0.5 text-[12.5px] leading-snug text-zinc-800">
        {sampleMessage.map((line, i) => (
          <p key={line} className={i === 0 ? "font-semibold" : undefined}>
            {line}
          </p>
        ))}
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-zinc-500">
          10:42 <CheckCheck className="size-3 text-sky-500" />
        </p>
      </div>
    </div>
  );
}

export function ListingCardMock({ className, withButton = true }: { className?: string; withButton?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-lifted", className)}>
      <div className="relative aspect-[16/10]">
        <PropertyIllustration variant="tower" tone={0} />
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-zinc-700 backdrop-blur">For Sale</span>
        <span className="absolute right-3 bottom-3 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">1 / 4</span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xl font-semibold tracking-tight">{sampleListing.price}</p>
          <p className="text-sm font-medium">{sampleListing.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {sampleListing.locality}, {sampleListing.city}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {[
            [BedDouble, sampleListing.bhk],
            [Maximize2, sampleListing.area],
            [Car, sampleListing.parking],
          ].map(([Icon, label]) => {
            const I = Icon as typeof BedDouble;
            return (
              <span key={label as string} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium text-zinc-700">
                <I className="size-3" /> {label as string}
              </span>
            );
          })}
        </div>
        {withButton && (
          <div className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-whatsapp text-xs font-semibold text-white">
            <WhatsAppIcon className="size-3.5" /> I&apos;m Interested
          </div>
        )}
      </div>
    </div>
  );
}

export function BrowserFrame({ url, children, className }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-lifted", className)}>
      <div className="flex items-center gap-2 border-b bg-surface px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-zinc-300" />
          <span className="size-2.5 rounded-full bg-zinc-300" />
          <span className="size-2.5 rounded-full bg-zinc-300" />
        </div>
        <div className="mx-auto flex min-w-0 max-w-sm flex-1 items-center justify-center gap-1 truncate rounded-md bg-background px-3 py-1 text-[11px] text-muted-foreground ring-1 ring-border">
          <span className="text-emerald-600">🔒</span>
          <span className="truncate">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export const sampleListingUrl = `${sampleBroker.subdomain}.propflow.in/property/${sampleListing.slug}`;
