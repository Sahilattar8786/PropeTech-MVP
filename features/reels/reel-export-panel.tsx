"use client";

import { AlertTriangle, Clapperboard, Download, Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type ReelExport =
  | { status: "idle" }
  | { status: "rendering"; progress: number }
  | { status: "done"; url: string; file: File; signature: string; canShare: boolean }
  | { status: "error"; message: string };

/** Create / progress / download / share — the result side of the Reel Studio. */
export function ReelExportPanel({
  state,
  stale,
  ready,
  lengthLabel,
  onCreate,
  onCancel,
  onShare,
}: {
  state: ReelExport;
  stale: boolean;
  ready: boolean;
  lengthLabel: string;
  onCreate: () => void;
  onCancel: () => void;
  onShare: () => void;
}) {
  if (state.status === "rendering") {
    const percent = Math.round(state.progress * 100);
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft" aria-live="polite">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Loader2 className="size-4 animate-spin" /> Creating video… {percent}%
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCancel}>
            <X className="size-3.5" /> Cancel
          </Button>
        </div>
        <Progress value={percent} aria-label="Video progress" />
        <p className="text-xs text-muted-foreground">Keep this tab open. It&apos;s made on your device, so nothing is uploaded.</p>
      </div>
    );
  }

  const done = state.status === "done";
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
      {state.status === "error" && (
        <p className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {state.message}
        </p>
      )}
      {done && !stale ? (
        <>
          <p className="text-sm font-medium">Your reel is ready</p>
          <div className="flex gap-2">
            {state.canShare && (
              <Button type="button" className="h-11 flex-1 rounded-xl" onClick={onShare}>
                <Share2 className="size-4" /> Share
              </Button>
            )}
            <Button asChild variant={state.canShare ? "outline" : "default"} className="h-11 flex-1 rounded-xl">
              <a href={state.url} download={state.file.name}>
                <Download className="size-4" /> Download {state.file.name.endsWith(".mp4") ? "MP4" : "video"}
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {state.canShare ? "Share → Instagram → Reels. Your caption is copied so you can paste it there." : "Upload it as a Reel from Instagram, or send it to your phone first."} Add music inside Instagram.
          </p>
        </>
      ) : (
        <>
          {stale && <p className="text-xs text-muted-foreground">You changed the reel after creating it. Create it again to include your edits.</p>}
          <Button type="button" className="h-11 w-full rounded-xl" disabled={!ready} onClick={onCreate}>
            <Clapperboard className="size-4" /> Create Reel video
          </Button>
          <p className="text-center text-xs text-muted-foreground">{lengthLabel} · 1080×1920 · no music</p>
        </>
      )}
    </div>
  );
}
