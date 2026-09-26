"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { REEL_HEIGHT, REEL_WIDTH, reelDurationSeconds } from "@/lib/reels/reel-spec";
import { drawReelFrame, type ScenePrepared } from "./reel-renderer";

export interface ReelPreviewHandle {
  /** Jump to a moment (seconds) and pause there — used when editing a slide. */
  seek(t: number): void;
}

/** Live, looping preview drawn by the same renderer as the export (at half resolution). */
export function ReelPreview({ scene, suspended = false, ref }: { scene: ScenePrepared | null; suspended?: boolean; ref?: React.Ref<ReelPreviewHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(scene);
  const timeRef = useRef(0);
  const [playing, setPlaying] = useState(true);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const current = sceneRef.current;
    if (!canvas || !current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(canvas.width / REEL_WIDTH, 0, 0, canvas.height / REEL_HEIGHT, 0, 0);
    drawReelFrame(ctx, current, timeRef.current);
    if (barRef.current) barRef.current.style.width = `${(timeRef.current / reelDurationSeconds(current.draft)) * 100}%`;
  }, []);

  useEffect(() => {
    sceneRef.current = scene;
    if (scene) timeRef.current = Math.min(timeRef.current, reelDurationSeconds(scene.draft) - 0.01);
    paint();
  }, [scene, paint]);

  const running = playing && !suspended && scene !== null;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const current = sceneRef.current;
      if (current) timeRef.current = (timeRef.current + Math.min(0.1, (now - last) / 1000)) % reelDurationSeconds(current.draft);
      last = now;
      paint();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, paint]);

  useImperativeHandle(ref, () => ({
    seek(t: number) {
      timeRef.current = Math.max(0, t);
      setPlaying(false);
      paint();
    },
  }), [paint]);

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[28px] bg-neutral-900 shadow-lifted ring-1 ring-black/10 lg:max-w-none">
      <canvas ref={canvasRef} width={REEL_WIDTH / 2} height={REEL_HEIGHT / 2} className="size-full" aria-label="Reel preview" role="img" />
      {!scene && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
          <Loader2 className="size-5 animate-spin" /> Loading photos…
        </div>
      )}
      <div className="absolute inset-x-3 top-3 h-1 overflow-hidden rounded-full bg-white/25">
        <div ref={barRef} className="h-full w-0 rounded-full bg-white" />
      </div>
      {scene && (
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
          aria-label={running ? "Pause preview" : "Play preview"}
        >
          {running ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
      )}
    </div>
  );
}
