import { WHATSAPP_ICON_PATH } from "@/components/shared/whatsapp-icon";
import { REEL_HEIGHT as H, REEL_WIDTH as W, reelTimeline, type ReelDraft, type ReelSegment } from "@/lib/reels/reel-spec";

/**
 * Draws Instagram Reel frames (1080×1920) onto a canvas. The same function drives the live
 * preview and the MP4 export, so what the broker previews is exactly what gets exported.
 *
 * Layout keeps text inside Instagram's safe area: clear of the top bar, the caption at the
 * bottom and the like/comment buttons on the right.
 */

const FADE = 0.4;
const SIDE = 72;
const TEXT_WIDTH = W - SIDE * 2 - 90;
const TEXT_BOTTOM = 1500;

export interface ReelPhoto {
  image: HTMLImageElement;
  /** A tiny copy of the photo; scaled up it becomes a soft blurred background. */
  backdrop: HTMLCanvasElement;
}

export interface ReelScene {
  draft: ReelDraft;
  photos: Map<string, ReelPhoto>;
  brand: { name: string; color: string; propertyId?: string };
  fontFamily: string;
}

/** Same-origin copy of a photo, resized by Next.js, so the canvas stays exportable. */
export function reelImageSrc(url: string): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=85`;
}

export async function loadReelPhoto(url: string): Promise<ReelPhoto> {
  const image = new Image();
  image.decoding = "async";
  image.src = reelImageSrc(url);
  await image.decode();
  const backdrop = document.createElement("canvas");
  backdrop.width = 108;
  backdrop.height = 192;
  const ctx = backdrop.getContext("2d")!;
  ctx.filter = "blur(5px)"; // ignored by browsers without canvas filters; the small size still softens it
  drawCover(ctx, image, backdrop.width, backdrop.height, 1.1, 0, 0);
  return { image, backdrop };
}

export function segmentAt(segments: ReelSegment[], t: number): number {
  for (let i = segments.length - 1; i >= 0; i--) if (t >= segments[i]!.start) return i;
  return 0;
}

export function drawReelFrame(ctx: CanvasRenderingContext2D, scene: ScenePrepared, t: number) {
  const { segments } = scene;
  const i = segmentAt(segments, t);
  const current = segments[i]!;
  const local = t - current.start;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (i > 0 && local < FADE) {
    const previous = segments[i - 1]!;
    drawSegment(ctx, scene, previous, t - previous.start);
    ctx.globalAlpha = easeInOut(local / FADE);
  }
  drawSegment(ctx, scene, current, local);
  ctx.restore();
}

export type ScenePrepared = ReelScene & { segments: ReelSegment[] };

export function prepareScene(scene: ReelScene): ScenePrepared {
  return { ...scene, segments: reelTimeline(scene.draft) };
}

function drawSegment(ctx: CanvasRenderingContext2D, scene: ScenePrepared, segment: ReelSegment, local: number) {
  const alpha = ctx.globalAlpha;
  const { draft } = scene;
  if (segment.kind === "outro") {
    drawOutro(ctx, scene, local);
    return;
  }
  const isIntro = segment.kind === "intro";
  const image = isIntro ? draft.intro.image : draft.slides[segment.index]!.image;
  const progress = Math.min(1, local / (segment.duration + FADE));
  drawPhoto(ctx, scene.photos.get(image), progress, segment.index);

  // Scrims keep white text readable on any photo.
  ctx.globalAlpha = alpha;
  const scrimTop = isIntro ? 950 : 1050;
  const bottom = ctx.createLinearGradient(0, scrimTop, 0, H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(0.4, "rgba(0,0,0,0.55)");
  bottom.addColorStop(1, "rgba(0,0,0,0.8)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);
  const top = ctx.createLinearGradient(0, 0, 0, 380);
  top.addColorStop(0, "rgba(0,0,0,0.45)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 380);

  const enter = easeOut(Math.min(1, Math.max(0, (local - 0.15) / 0.55)));
  ctx.globalAlpha = alpha * enter;
  const rise = (1 - enter) * 28;

  if (isIntro) {
    drawBrandChip(ctx, scene, SIDE, 236);
    let y = TEXT_BOTTOM + rise;
    if (draft.intro.subtitle) {
      setFont(ctx, scene, 500, 46);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      const lines = wrap(ctx, draft.intro.subtitle, TEXT_WIDTH, 2);
      y = drawLinesUp(ctx, lines, SIDE, y, 58);
      y -= 26;
    }
    setFont(ctx, scene, 700, 84);
    ctx.fillStyle = "#fff";
    const lines = wrap(ctx, draft.intro.title, TEXT_WIDTH, 3);
    y = drawLinesUp(ctx, lines, SIDE, y, 96);
    drawAccent(ctx, scene, SIDE, y - 40);
  } else {
    drawBrandLabel(ctx, scene);
    const title = draft.slides[segment.index]!.title;
    if (title) {
      setFont(ctx, scene, 700, 66);
      ctx.fillStyle = "#fff";
      const y = drawLinesUp(ctx, wrap(ctx, title, TEXT_WIDTH, 2), SIDE, TEXT_BOTTOM + rise, 78);
      drawAccent(ctx, scene, SIDE, y - 36);
    }
  }
  ctx.globalAlpha = alpha;
}

/** Portrait photos fill the frame; landscape photos sit whole on a blurred copy of themselves. */
function drawPhoto(ctx: CanvasRenderingContext2D, photo: ReelPhoto | undefined, progress: number, index: number) {
  if (!photo) {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const { image, backdrop } = photo;
  const zoom = 1 + 0.08 * easeInOut(progress);
  const aspect = image.naturalWidth / image.naturalHeight;
  if (aspect < 0.72) {
    const pan = (index % 2 === 0 ? -1 : 1) * (progress - 0.5) * 0.6;
    drawCover(ctx, image, W, H, zoom, pan, 0);
    return;
  }
  const alpha = ctx.globalAlpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(backdrop, -40, -40, W + 80, H + 80);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha;
  const width = W * zoom;
  const height = width / aspect;
  const centerY = 800;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, centerY - (W / aspect) / 2, W, W / aspect);
  ctx.clip();
  ctx.drawImage(image, (W - width) / 2, centerY - height / 2, width, height);
  ctx.restore();
}

function drawOutro(ctx: CanvasRenderingContext2D, scene: ScenePrepared, local: number) {
  const alpha = ctx.globalAlpha;
  const { draft, brand } = scene;
  const cover = scene.photos.get(draft.intro.image);
  if (cover) ctx.drawImage(cover.backdrop, -40, -40, W + 80, H + 80);
  ctx.globalAlpha = alpha * (cover ? 0.9 : 1);
  ctx.fillStyle = brand.color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha;
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  const enter = easeOut(Math.min(1, local / 0.6));
  ctx.globalAlpha = alpha * enter;
  const cx = W / 2;
  let y = 720 + (1 - enter) * 30;

  // WhatsApp badge
  const pulse = 1 + 0.04 * Math.sin(local * 4);
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "#25D366";
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.translate(-60, -60);
  ctx.scale(5, 5);
  ctx.fill(new Path2D(WHATSAPP_ICON_PATH));
  ctx.restore();

  y += 190;
  ctx.textAlign = "center";
  if (draft.outro.title) {
    setFont(ctx, scene, 700, 72);
    ctx.fillStyle = "#fff";
    y = drawLinesDown(ctx, wrap(ctx, draft.outro.title, W - 240, 3), cx, y, 84);
  }
  if (draft.outro.subtitle) {
    setFont(ctx, scene, 500, 44);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    y = drawLinesDown(ctx, wrap(ctx, draft.outro.subtitle, W - 240, 3), cx, y + 18, 56);
  }
  if (brand.propertyId) {
    setFont(ctx, scene, 600, 38);
    const label = `Property ID: ${brand.propertyId}`;
    const width = ctx.measureText(label).width + 72;
    const top = y + 44;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, cx - width / 2, top, width, 78, 39);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, top + 40);
    ctx.textBaseline = "alphabetic";
  }
  ctx.textAlign = "left";
  ctx.globalAlpha = alpha;
}

function drawBrandChip(ctx: CanvasRenderingContext2D, scene: ScenePrepared, x: number, y: number) {
  setFont(ctx, scene, 600, 36);
  const label = scene.brand.name;
  const width = Math.min(ctx.measureText(label).width + 64, W - SIDE * 2 - 120);
  ctx.fillStyle = scene.brand.color;
  roundRect(ctx, x, y - 38, width, 76, 38);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(fit(ctx, label, width - 64), x + 32, y + 2);
  ctx.textBaseline = "alphabetic";
}

function drawBrandLabel(ctx: CanvasRenderingContext2D, scene: ScenePrepared) {
  setFont(ctx, scene, 600, 34);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10;
  ctx.fillText(fit(ctx, scene.brand.name, W - SIDE * 2 - 120), SIDE, 250);
  ctx.shadowBlur = 0;
}

function drawAccent(ctx: CanvasRenderingContext2D, scene: ScenePrepared, x: number, y: number) {
  ctx.fillStyle = scene.brand.color;
  roundRect(ctx, x, y, 88, 10, 5);
  ctx.fill();
}

// ── helpers ──────────────────────────────────────────────────────────────

function setFont(ctx: CanvasRenderingContext2D, scene: ScenePrepared, weight: number, size: number) {
  ctx.font = `${weight} ${size}px ${scene.fontFamily}`;
}

/** Draws lines so the last one sits on `bottom`; returns the top of the first line. */
function drawLinesUp(ctx: CanvasRenderingContext2D, lines: string[], x: number, bottom: number, lineHeight: number): number {
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 14;
  lines.forEach((line, i) => ctx.fillText(line, x, bottom - (lines.length - 1 - i) * lineHeight));
  ctx.shadowBlur = 0;
  return bottom - (lines.length - 1) * lineHeight - lineHeight;
}

/** Draws lines downward from `top` (first baseline at top + lineHeight); returns the last baseline. */
function drawLinesDown(ctx: CanvasRenderingContext2D, lines: string[], x: number, top: number, lineHeight: number): number {
  lines.forEach((line, i) => ctx.fillText(line, x, top + (i + 1) * lineHeight));
  return top + lines.length * lineHeight;
}

export function wrap(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines.map((l) => fit(ctx, l, maxWidth));
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(ctx, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, maxWidth);
  return kept;
}

/** Truncates with an ellipsis so the text fits `maxWidth`. */
function fit(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end).trimEnd()}…`).width > maxWidth) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, zoom: number, panX: number, panY: number) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const scale = Math.max(width / iw, height / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (width - dw) / 2 + (panX * (dw - width)) / 2, (height - dh) / 2 + (panY * (dh - height)) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
