import Link from "next/link";
import { ArrowRight, Sparkles, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { siteConfig } from "@/lib/config/site";
import { brokerDisplayHost } from "@/lib/urls";
import { BrokerMessageBubble, ChatHeader, ListingCardMock, PhoneFrame, sampleListingUrl } from "./mockups";
import { sampleListing } from "./content";

const FLOW = [
  { label: "WhatsApp", icon: WhatsAppIcon },
  { label: "AI", icon: Sparkles },
  { label: "Property Listing", icon: null },
  { label: "Customer", icon: UserRound },
  { label: "WhatsApp Lead", icon: WhatsAppIcon },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_70%_0%,var(--brand-soft),transparent_70%)]" />
      <div className="container-page grid items-center gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div className="animate-fade-up">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-xs font-medium text-muted-foreground shadow-soft">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">
              <Store className="size-3.5" /> {siteConfig.positioning}
            </span>
            Built for Indian brokers
          </p>
          <h1 className="text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[3.4rem] lg:text-[4rem]">
            Launch your property website <span className="text-brand">in minutes.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg text-pretty">{siteConfig.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-xl px-6 text-[15px]">
              <Link href="/register">
                Start Free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-xl px-6 text-[15px]">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Free for 10 properties · No credit card · Your site at <span className="font-medium text-foreground">{brokerDisplayHost({ slug: "yourname" })}</span>
          </p>
        </div>

        <HeroVisual />
      </div>

      <div className="container-page pb-12">
        <ol className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 text-sm sm:justify-center" aria-label={`How ${siteConfig.name} works`}>
          {FLOW.map((step, i) => (
            <li key={step.label} className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 font-medium shadow-soft">
                {step.icon ? <step.icon className="size-3.5 text-brand" /> : <span className="size-2 rounded-full bg-brand" />}
                {step.label}
              </span>
              {i < FLOW.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] animate-fade-up pb-10 [animation-delay:120ms]">
      {/* Mobile: layered story (message → listing). sm+: side by side. */}
      <div className="grid grid-cols-12 items-start sm:items-center sm:gap-6">
        <PhoneFrame className="col-span-8 col-start-1 row-start-1 w-full max-w-[250px] sm:col-span-6 sm:justify-self-end">
          <ChatHeader />
          <div className="space-y-2 p-2.5 pb-4 sm:p-3">
            <p className="mx-auto w-fit rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-zinc-500">Today</p>
            <BrokerMessageBubble compact />
          </div>
        </PhoneFrame>

        <div className="relative z-10 col-span-7 col-start-6 row-start-1 mt-44 sm:col-span-6 sm:col-start-7 sm:mt-0">
          <span className="absolute top-10 right-3 z-10 inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold text-brand shadow-soft">
            <Sparkles className="size-3.5" /> AI organised
          </span>
          <ListingCardMock url={sampleListingUrl} />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-20 flex items-center gap-3 rounded-2xl border bg-background/95 p-3 pr-4 shadow-lifted backdrop-blur sm:left-10">
        <span className="flex size-9 items-center justify-center rounded-full bg-whatsapp/10 text-whatsapp">
          <WhatsAppIcon className="size-5" />
        </span>
        <div className="text-xs leading-tight">
          <p className="font-semibold">New WhatsApp lead</p>
          <p className="text-muted-foreground">Enquiry for {sampleListing.id} · just now</p>
        </div>
      </div>
    </div>
  );
}
