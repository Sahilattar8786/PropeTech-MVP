import { REEL_FPS, REEL_HEIGHT, REEL_WIDTH } from "@/lib/reels/reel-spec";

export interface EncodedReel {
  blob: Blob;
  extension: "mp4" | "webm";
}

type DrawFrame = (ctx: CanvasRenderingContext2D, t: number) => void;

/**
 * Renders the reel frame by frame into a video file in the browser.
 * H.264 MP4 via WebCodecs (fast, what Instagram expects); older browsers record the
 * canvas in real time with MediaRecorder instead.
 */
export async function encodeReel(draw: DrawFrame, duration: number, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<EncodedReel> {
  const canvas = document.createElement("canvas");
  canvas.width = REEL_WIDTH;
  canvas.height = REEL_HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  const mb = typeof VideoEncoder === "undefined" ? null : await import("mediabunny");
  const size = { width: REEL_WIDTH, height: REEL_HEIGHT };
  const codec = mb ? ((await mb.canEncodeVideo("avc", size)) ? "avc" : (await mb.canEncodeVideo("hevc", size)) ? "hevc" : null) : null;
  if (!mb || !codec) return recordRealtime(canvas, ctx, draw, duration, onProgress, signal);

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const source = new mb.CanvasSource(canvas, { codec, quality: mb.QUALITY_HIGH, keyFrameInterval: 1 });
  output.addVideoTrack(source, { frameRate: REEL_FPS });
  await output.start();
  const frames = Math.ceil(duration * REEL_FPS);
  try {
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const t = i / REEL_FPS;
      draw(ctx, t);
      await source.add(t, 1 / REEL_FPS);
      if (i % 6 === 0) onProgress(i / frames);
    }
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  }
  onProgress(1);
  return { blob: new Blob([output.target.buffer!], { type: "video/mp4" }), extension: "mp4" };
}

function recordRealtime(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, draw: DrawFrame, duration: number, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<EncodedReel> {
  if (typeof MediaRecorder === "undefined" || !canvas.captureStream) {
    return Promise.reject(new Error("This browser can't create videos. Please use the latest Chrome, Safari or Edge."));
  }
  const mimeType = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
  const stream = canvas.captureStream(REEL_FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  return new Promise((resolve, reject) => {
    let frame = 0;
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
      const type = recorder.mimeType || mimeType || "video/webm";
      resolve({ blob: new Blob(chunks, { type }), extension: type.includes("mp4") ? "mp4" : "webm" });
    };
    draw(ctx, 0);
    recorder.start();
    const started = performance.now();
    const tick = () => {
      const t = (performance.now() - started) / 1000;
      if (signal.aborted || t >= duration) {
        onProgress(1);
        recorder.stop();
        return;
      }
      draw(ctx, t);
      if (frame++ % 6 === 0) onProgress(t / duration);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
