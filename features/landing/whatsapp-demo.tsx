"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PropertyIllustration } from "@/components/shared/property-illustration";
import { BrokerMessageBubble, ChatHeader, PhoneFrame } from "./mockups";
import { processingSteps, sampleListing } from "./content";

/**
 * Main product demonstration: WhatsApp message → PropFlow processing → draft ready.
 * Advances step by step once visible; respects reduced-motion (shows the end state).
 */
const TOTAL = processingSteps.length + 2; // message + steps + draft

export function WhatsAppDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(TOTAL);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const delay = step === 0 ? 700 : step >= TOTAL ? 5000 : 650;
    const timer = setTimeout(() => setStep((s) => (s >= TOTAL ? 0 : s + 1)), delay);
    return () => clearTimeout(timer);
  }, [visible, step]);

  const doneSteps = Math.max(0, Math.min(processingSteps.length, step - 1));
  const draftReady = step >= TOTAL;

  return (
    <div ref={ref} className="grid items-start gap-5 lg:grid-cols-3 lg:gap-6">
      <Panel index="1" title="Broker sends on WhatsApp" active={step >= 0}>
        <PhoneFrame className="mx-auto w-full max-w-[290px]">
          <ChatHeader />
          <div className="space-y-2 p-3 pb-5">
            <p className="mx-auto w-fit rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-zinc-500">Today</p>
            <BrokerMessageBubble />
          </div>
        </PhoneFrame>
      </Panel>

      <Panel index="2" title="PropFlow organises it" active={step >= 1}>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">PropFlow</p>
              <p className="text-xs text-muted-foreground">{draftReady ? "Done in 8 seconds" : step >= 1 ? "Processing…" : "Waiting for message"}</p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {processingSteps.map((label, i) => {
              const done = i < doneSteps;
              const current = i === doneSteps && step >= 1 && !draftReady;
              return (
                <li key={label} className={cn("flex items-center gap-2.5 text-sm transition-opacity duration-300", done || current ? "opacity-100" : "opacity-35")}>
                  <span className={cn("flex size-5 items-center justify-center rounded-full transition-colors", done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                    {done ? <Check className="size-3" strokeWidth={3} /> : current ? <Loader2 className="size-3 animate-spin" /> : null}
                  </span>
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>

      <Panel index="3" title="Draft ready for your review" active={draftReady}>
        <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-lifted transition-all duration-500", draftReady ? "translate-y-0 opacity-100" : "translate-y-2 opacity-40")}>
          <div className="flex items-center justify-between border-b bg-amber-50/60 px-4 py-2.5">
            <p className="text-[11px] font-semibold tracking-wider text-amber-800 uppercase">Property draft ready</p>
            <span className="text-[11px] font-medium text-amber-800">AI confidence 96%</span>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-3 p-4">
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <PropertyIllustration variant="tower" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{sampleListing.title}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {sampleListing.locality}, {sampleListing.city}
              </p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight">{sampleListing.price}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t text-center text-xs">
            {[sampleListing.area, sampleListing.bhk, sampleListing.parking].map((v) => (
              <div key={v} className="border-r px-2 py-2.5 font-medium last:border-r-0">
                {v}
              </div>
            ))}
          </div>
          <div className="p-4 pt-3">
            <div className="flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">Review Property</div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Nothing goes live until you publish.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Panel({ index, title, active, children }: { index: string; title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn("mb-3 flex items-center gap-2 text-sm font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
        <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors", active ? "bg-primary text-primary-foreground" : "bg-muted")}>{index}</span>
        {title}
      </p>
      {children}
    </div>
  );
}
