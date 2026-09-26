"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ImageOff, Loader2, PenLine, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryAIAction, retryMediaAction } from "./actions";

/** Polls while AI/media processing runs in the background queue. */
export function ProcessingWatcher({ label }: { label: string }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center shadow-soft" role="status" aria-live="polite">
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Sparkles className="size-6" />
        <Loader2 className="absolute -right-1.5 -bottom-1.5 size-5 animate-spin rounded-full bg-background p-0.5" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">{label}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">We&apos;re organising the details from WhatsApp. This page updates automatically — usually within a few seconds.</p>
    </div>
  );
}

export function ProcessingFailed({ propertyId, message, onReviewManually }: { propertyId: string; message?: string; onReviewManually?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
      <p className="flex items-center gap-2 font-semibold text-red-900">
        <AlertTriangle className="size-4" /> {message ?? "We couldn't automatically process this property."}
      </p>
      <p className="mt-1 text-sm text-red-800/80">Your photos and message are saved. Fill in the details yourself or let AI try again.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="bg-background"
          onClick={() => {
            setHidden(true);
            onReviewManually?.();
          }}
        >
          <PenLine className="size-4" /> Review Manually
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await retryAIAction(propertyId);
              if (!result.ok) return void toast.error(result.error);
              toast.success("Retrying AI processing…");
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Retry AI Processing
        </Button>
      </div>
    </div>
  );
}

export function MediaFailed({ propertyId, count }: { propertyId: string; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-medium">
        <ImageOff className="size-4" /> Media processing failed for {count} {count === 1 ? "photo" : "photos"}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="bg-background"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await retryMediaAction(propertyId);
            if (!result.ok) return void toast.error(result.error);
            toast.success(`Retrying ${result.data.retried} ${result.data.retried === 1 ? "photo" : "photos"}`);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Retry
      </Button>
    </div>
  );
}
