import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  Copy,
  FolderOpen,
  Globe,
  Home,
  Layers,
  MapPin,
  Maximize2,
  MessagesSquare,
  Repeat,
  Send,
  Share2,
  Sparkles,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/badges";
import { PropertyIllustration } from "@/components/shared/property-illustration";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { LogoMark } from "@/components/shared/logo";
import { PLANS, PLAN_IDS } from "@/lib/config/plans";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";
import { dashboardMetrics, dashboardRows, sampleBroker, sampleCollections, sampleListing } from "./content";
import { BrowserFrame, SectionHeading, sampleListingUrl } from "./mockups";
import { WhatsAppDemo } from "./whatsapp-demo";

/* ─────────────────────────── Problem ─────────────────────────── */

const PROBLEMS = [
  { icon: MessagesSquare, title: "Messy Property Sharing", body: "Property information is scattered across WhatsApp conversations, forwards and photo dumps." },
  { icon: Repeat, title: "Repetitive Work", body: "Brokers repeatedly send the same images and property details to every new customer." },
  { icon: Unlink, title: "Lost Context", body: "Customers receive property information without a professional property page or a clear way to enquire." },
];

export function ProblemSection() {
  return (
    <section className="border-y bg-surface py-20 sm:py-24">
      <div className="container-page">
        <SectionHeading eyebrow="The problem" title="Your property inventory shouldn't live inside WhatsApp chats." />
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROBLEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border bg-card p-6 shadow-soft">
              <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── How it works ─────────────────────────── */

const EXTRACTED = ["Property type", "Location", "Price", "Area", "BHK", "Amenities", "Description"];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading eyebrow="How it works" title="From WhatsApp message to professional listing." description="Keep working the way you already do. PropFlow does the organising — you stay in control of what gets published." />
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step n="01" icon={Send} title="Send" body="Send property details and images to your PropFlow WhatsApp number — like you'd send them to a customer." />
          <Step n="02" icon={Sparkles} title="AI organises" body="AI extracts the facts from your message. It never invents details you didn't send.">
            <div className="mt-4 flex flex-wrap gap-1.5">
              {EXTRACTED.map((f) => (
                <span key={f} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                  {f}
                </span>
              ))}
            </div>
          </Step>
          <Step n="03" icon={Check} title="Review & publish" body="Check the draft, edit anything, and publish when it looks right. Nothing goes live automatically." />
          <Step n="04" icon={Share2} title="Share" body="Get a clean, shareable link in one click — and customer enquiries straight on WhatsApp.">
            <div className="mt-4 flex min-w-0 items-center gap-2 rounded-lg border bg-surface px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
              <span className="truncate">{sampleListingUrl}</span>
              <Copy className="size-3.5 shrink-0" />
            </div>
          </Step>
        </div>
      </div>
    </section>
  );
}

function Step({ n, icon: Icon, title, body, children }: { n: string; icon: typeof Send; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="relative flex min-w-0 flex-col rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-muted-foreground">{n}</span>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}

/* ─────────────────────────── WhatsApp ─────────────────────────── */

export function WhatsAppSection() {
  return (
    <section id="whatsapp" className="scroll-mt-20 bg-[#f6f5f1] py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="WhatsApp workflow"
          title="Your WhatsApp is already your CRM. We make it smarter."
          description="Forward a property to PropFlow the same way you share it today. Seconds later you get a structured draft to review — right on WhatsApp."
        />
        <div className="mt-14">
          <WhatsAppDemo />
        </div>
        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
          WhatsApp → AI → Draft → Your review → Publish. AI-generated properties are never published automatically.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── Listing preview ─────────────────────────── */

export function ListingPreviewSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-page grid items-center gap-12 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Professional listings"
            title="Listings your customers actually want to open."
            description="Every property gets a fast, mobile-first page with a photo gallery, clear pricing, highlights, location and a one-tap WhatsApp enquiry that tells you exactly which property they mean."
          />
          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
            {["Large image gallery", "Price, BHK & area at a glance", "Amenities & description", "Location map", "Your broker profile", "WhatsApp CTA with property context"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="size-4 text-brand" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <BrowserFrame url={sampleListingUrl}>
          <div className="grid grid-cols-4 grid-rows-2 gap-1.5 p-1.5">
            <div className="relative col-span-3 row-span-2 aspect-[4/3] overflow-hidden rounded-lg sm:aspect-auto">
              <PropertyIllustration variant="tower" />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <PropertyIllustration variant="interior" tone={1} />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <PropertyIllustration variant="courtyard" tone={2} />
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">+6</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-[1fr_210px]">
            <div>
              <p className="text-2xl font-semibold tracking-tight">{sampleListing.price}</p>
              <h3 className="mt-0.5 text-base font-semibold">{sampleListing.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {sampleListing.locality}, {sampleListing.city}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  [BedDouble, sampleListing.bhk],
                  [Maximize2, sampleListing.area],
                  [Building2, sampleListing.type],
                ].map(([Icon, v]) => {
                  const I = Icon as typeof BedDouble;
                  return (
                    <div key={v as string} className="rounded-lg bg-muted px-2 py-2.5">
                      <I className="mx-auto size-4 text-muted-foreground" />
                      <p className="mt-1 text-xs font-medium">{v as string}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs font-semibold">Amenities</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sampleListing.amenities.map((a) => (
                  <span key={a} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {a}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">RK</span>
                  <div className="text-xs leading-tight">
                    <p className="font-semibold">{sampleBroker.name}</p>
                    <p className="text-muted-foreground">{sampleBroker.city}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-whatsapp px-2 py-2 text-center text-[11px] leading-tight font-semibold text-white">
                  <WhatsAppIcon className="size-3.5" /> I&apos;m Interested — WhatsApp Broker
                </div>
              </div>
              <div className="relative h-24 overflow-hidden rounded-xl border bg-[#eef1ea]">
                <svg viewBox="0 0 200 100" className="h-full w-full" aria-hidden>
                  <path d="M0 60 Q60 40 110 62 T200 50" stroke="#fff" strokeWidth="8" fill="none" />
                  <path d="M70 0 L90 100" stroke="#fff" strokeWidth="5" />
                  <path d="M140 0 Q150 50 130 100" stroke="#fff" strokeWidth="4" fill="none" />
                </svg>
                <MapPin className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-full fill-red-500 text-white" />
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>
    </section>
  );
}

/* ─────────────────────────── Dashboard preview ─────────────────────────── */

export function DashboardPreviewSection() {
  return (
    <section className="border-y bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading eyebrow="Broker dashboard" title="Your whole inventory, finally in one place." description="See what's live, what's selling, and which listings bring in WhatsApp enquiries." />
        <div className="mt-12 overflow-hidden rounded-2xl border bg-card shadow-lifted">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LogoMark className="size-6" /> Dashboard
            </div>
            <span className="flex size-7 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">RK</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
            {dashboardMetrics.map((m) => (
              <div key={m.label} className="bg-card px-5 py-4">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{m.value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-y bg-surface text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Property</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Views</th>
                  <th className="px-5 py-2.5 text-right font-medium">Leads</th>
                </tr>
              </thead>
              <tbody>
                {dashboardRows.map((r, i) => (
                  <tr key={r.property} className="border-b last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-9 overflow-hidden rounded-lg">
                          <PropertyIllustration variant={i === 1 ? "villa" : i === 2 ? "office" : "tower"} tone={i} />
                        </div>
                        <span className="font-medium">{r.property}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.views}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Branded website ─────────────────────────── */

export function BrandedWebsiteSection() {
  return (
    <section id="website" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <BrowserFrame url={`${sampleBroker.subdomain}.propflow.in`} className="order-2 lg:order-1">
          <div className="bg-[linear-gradient(180deg,var(--brand-soft),transparent)] px-6 pt-8 pb-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">RP</span>
              <div>
                <p className="text-lg font-semibold">{sampleBroker.name}</p>
                <p className="text-xs text-muted-foreground">
                  {sampleBroker.tagline} · {sampleBroker.city}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
              {[
                [Home, "Properties"],
                [Layers, "Collections"],
                [WhatsAppIcon, "Contact"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Home;
                return (
                  <span key={label as string} className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 shadow-soft">
                    <I className="size-3.5" /> {label as string}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4">
            {(["tower", "villa", "office"] as const).map((v, i) => (
              <div key={v} className="overflow-hidden rounded-lg border">
                <div className="relative aspect-[4/3]">
                  <PropertyIllustration variant={v} tone={i} />
                </div>
                <div className="space-y-1 p-2">
                  <div className="h-2 w-2/3 rounded bg-zinc-200" />
                  <div className="h-2 w-1/2 rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </BrowserFrame>
        <div className="order-1 lg:order-2">
          <SectionHeading align="left" eyebrow="Broker website" title="Give your real-estate business its own website." description="Every broker receives a branded profile with all published properties and collections — ready to share on WhatsApp, Instagram and your visiting card." />
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
              <Globe className="size-5 text-brand" />
              <div className="text-sm">
                <p className="font-mono font-medium">{sampleBroker.subdomain}.propflow.in</p>
                <p className="text-muted-foreground">Included on every plan</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
              <Globe className="size-5 text-amber-600" />
              <div className="text-sm">
                <p className="font-mono font-medium">www.rehanproperties.com</p>
                <p className="text-muted-foreground">Connect your own domain on Business</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Collections ─────────────────────────── */

export function CollectionsSection() {
  return (
    <section className="border-t bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading eyebrow="Collections" title="Share the right shortlist, not your entire inventory." description="Group properties into collections and share one link. Perfect for “what do you have in Whitefield under 1.5 Cr?”" />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {sampleCollections.map((c) => (
            <div key={c.name} className="group overflow-hidden rounded-2xl border bg-card shadow-soft">
              <div className="relative aspect-[4/3] overflow-hidden">
                <PropertyIllustration variant={c.variant} tone={c.tone} className="transition-transform duration-500 group-hover:scale-[1.03]" />
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold sm:text-base">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <FolderOpen className="size-3.5" /> {c.count} Properties
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Organise by</span>
          {["Location", "Property type", "Price", "BHK", "Investment category"].map((t) => (
            <span key={t} className="rounded-full border bg-background px-3 py-1 font-medium">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Pricing ─────────────────────────── */

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading eyebrow="Pricing" title="Simple pricing that grows with your inventory." description="Start free. Every new workspace includes a 14-day Pro trial." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 lg:grid-cols-3">
          {PLAN_IDS.map((id) => {
            const plan = PLANS[id];
            return (
              <div key={id} className={cn("relative flex flex-col rounded-2xl border bg-card p-6 shadow-soft", plan.highlighted && "border-primary shadow-lifted ring-1 ring-primary")}>
                {plan.highlighted && <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">Most popular</span>}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">₹{plan.priceMonthly.toLocaleString("en-IN")}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={plan.highlighted ? "default" : "outline"} className="mt-8 h-11 rounded-xl">
                  {id === "business" ? <a href={`mailto:${siteConfig.supportEmail}?subject=PropFlow%20Business`}>{plan.cta}</a> : <Link href={`/register?plan=${id}`}>{plan.cta}</Link>}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── CTA + Footer ─────────────────────────── */

export function FinalCta() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-16">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,oklch(0.5_0.09_184/0.45),transparent)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Send your next property on WhatsApp. Share it as a professional listing.</h2>
            <p className="mx-auto mt-4 max-w-lg text-primary-foreground/70">Set up your broker workspace in two minutes. Free for your first 10 properties.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-xl bg-background px-6 text-[15px] text-foreground hover:bg-background/90">
                <Link href="/register">
                  Start Free <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t py-10">
      <div className="container-page flex flex-col gap-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <LogoMark className="size-6" />
          <span className="font-semibold">{siteConfig.name}</span>
          <span className="text-muted-foreground">· {siteConfig.secondaryTagline}</span>
        </div>
        <nav className="flex flex-wrap gap-5">
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link href="/login" className="hover:text-foreground">Log in</Link>
          <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-foreground">Contact</a>
        </nav>
        <p>© {new Date().getFullYear()} {siteConfig.name}</p>
      </div>
    </footer>
  );
}

