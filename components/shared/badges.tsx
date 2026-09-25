import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_STATE_LABELS, PROPERTY_STATUS_LABELS, type PipelineState, type PropertyStatus } from "@/lib/domain/property";

const STATUS_STYLES: Record<PropertyStatus, string> = {
  draft: "bg-muted text-muted-foreground ring-border",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  reserved: "bg-amber-50 text-amber-800 ring-amber-200",
  sold: "bg-sky-50 text-sky-800 ring-sky-200",
  rented: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  delisted: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const DOT_STYLES: Record<PropertyStatus, string> = {
  draft: "bg-zinc-400",
  active: "bg-emerald-500",
  reserved: "bg-amber-500",
  sold: "bg-sky-500",
  rented: "bg-indigo-500",
  delisted: "bg-zinc-400",
};

export function StatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLES[status], className)}>
      <span className={cn("size-1.5 rounded-full", DOT_STYLES[status])} />
      {PROPERTY_STATUS_LABELS[status]}
    </span>
  );
}

export function AIBadge({ confidence, className }: { confidence?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand ring-1 ring-brand/15 ring-inset", className)}
      title={confidence !== undefined ? `AI confidence ${Math.round(confidence * 100)}%` : undefined}
    >
      <Sparkles className="size-3" aria-hidden />
      AI Generated
    </span>
  );
}

const PIPELINE_STYLES: Record<PipelineState, string> = {
  received: "bg-zinc-100 text-zinc-700",
  processing: "bg-sky-50 text-sky-800",
  ai_processing: "bg-brand-soft text-brand",
  draft_ready: "bg-amber-50 text-amber-800",
  reviewed: "bg-indigo-50 text-indigo-700",
  published: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

export function PipelineBadge({ state, className }: { state: PipelineState; className?: string }) {
  const busy = state === "processing" || state === "ai_processing" || state === "received";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", PIPELINE_STYLES[state], className)}>
      <span className={cn("size-1.5 rounded-full bg-current", busy && "animate-pulse-soft")} />
      {PIPELINE_STATE_LABELS[state]}
    </span>
  );
}
