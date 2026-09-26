"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Check, Copy, Loader2, Plus, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { INSTAGRAM_CAPTION_LIMIT, MAX_REEL_SLIDES, reelDraftSchema, reelDurationSeconds, reelTimeline, type ReelDraft } from "@/lib/reels/reel-spec";
import { cn } from "@/lib/utils";
import { saveReelDraftAction } from "@/features/properties/actions";
import { copyText } from "@/features/properties/share-menu";
import { encodeReel } from "./encode";
import { ReelExportPanel, type ReelExport } from "./reel-export-panel";
import { ReelPreview, type ReelPreviewHandle } from "./reel-preview";
import { drawReelFrame, loadReelPhoto, prepareScene, type ReelPhoto, type ReelScene } from "./reel-renderer";

const DURATIONS = ["2", "2.5", "3", "4", "5"];

interface Assets {
  photos: Map<string, ReelPhoto>;
  fontFamily: string;
  failed: number;
}

/** Everything that changes the video (the caption doesn't). */
const videoSignature = (draft: ReelDraft) => JSON.stringify({ ...draft, caption: "" });

function formatLength(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ReelStudio({
  propertyId,
  fileName,
  images,
  initial,
  defaults,
  brand,
}: {
  propertyId: string;
  fileName: string;
  images: string[];
  initial: ReelDraft;
  defaults: ReelDraft;
  brand: ReelScene["brand"];
}) {
  const form = useForm<ReelDraft>({ resolver: zodResolver(reelDraftSchema), defaultValues: initial, mode: "onTouched" });
  const { errors, isDirty } = form.formState;
  const slides = useFieldArray({ control: form.control, name: "slides" });
  const draft = useWatch({ control: form.control }) as ReelDraft;
  const previewRef = useRef<ReelPreviewHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [video, setVideo] = useState<ReelExport>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);

  // Load photos (same-origin, resized) and the page font once, before drawing anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";
      await Promise.all([500, 600, 700].map((weight) => document.fonts.load(`${weight} 64px ${fontFamily}`).catch(() => [])));
      const results = await Promise.allSettled(images.map(loadReelPhoto));
      if (cancelled) return;
      const photos = new Map<string, ReelPhoto>();
      results.forEach((result, i) => result.status === "fulfilled" && photos.set(images[i]!, result.value));
      setAssets({ photos, fontFamily, failed: results.length - photos.size });
    })();
    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    },
    [],
  );

  const scene = useMemo(() => (assets ? prepareScene({ draft, photos: assets.photos, brand, fontFamily: assets.fontFamily }) : null), [assets, draft, brand]);
  const timeline = reelTimeline(draft);
  const seekSlide = (segment: number) => previewRef.current?.seek((timeline[segment]?.start ?? 0) + 1.1);
  const stale = video.status === "done" && video.signature !== videoSignature(draft);
  const unused = images.filter((url) => !draft.slides.some((s) => s.image === url));

  async function save(data: ReelDraft, quiet = false) {
    setSaving(true);
    setServerError(null);
    try {
      const result = await saveReelDraftAction(propertyId, data);
      if (!result.ok) return setServerError(result.error);
      form.reset(data);
      if (!quiet) toast.success("Reel saved");
    } finally {
      setSaving(false);
    }
  }

  const create = () =>
    form.handleSubmit(async (data) => {
      if (!assets) return;
      if (isDirty) void save(data, true);
      const controller = new AbortController();
      abortRef.current = controller;
      setVideo({ status: "rendering", progress: 0 });
      document.getElementById("reel-export")?.scrollIntoView({ behavior: "smooth", block: "center" });
      try {
        const prepared = prepareScene({ draft: data, photos: assets.photos, brand, fontFamily: assets.fontFamily });
        const { blob, extension } = await encodeReel(
          (ctx, t) => drawReelFrame(ctx, prepared, t),
          reelDurationSeconds(data),
          (progress) => setVideo({ status: "rendering", progress }),
          controller.signal,
        );
        const file = new File([blob], `${fileName}-reel.${extension}`, { type: blob.type });
        if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = URL.createObjectURL(blob);
        const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
        setVideo({ status: "done", url: videoUrlRef.current, file, signature: videoSignature(data), canShare });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") setVideo({ status: "idle" });
        else {
          console.error("[reel] export failed", error);
          setVideo({ status: "error", message: "Couldn't create the video on this device. Try again, or use the latest Chrome or Safari." });
        }
      } finally {
        abortRef.current = null;
      }
    })();

  function share() {
    if (video.status !== "done") return;
    // Both must start inside the tap, before any await, or Safari blocks them.
    const copied = copyText(draft.caption);
    navigator
      .share({ files: [video.file] })
      .then(async () => {
        if (await copied) toast.success("Caption copied — paste it in Instagram");
      })
      .catch((error: DOMException) => {
        if (error.name !== "AbortError") toast.error("Couldn't open sharing — download the video instead");
      });
  }

  async function copyCaption() {
    if (await copyText(draft.caption)) {
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 1500);
    } else toast.error("Couldn't copy — select the text and copy it");
  }

  function startOver() {
    const previous = form.getValues();
    form.reset(defaults, { keepDefaultValues: true });
    toast("Reel reset to the property details", { action: { label: "Undo", onClick: () => form.reset(previous, { keepDefaultValues: true }) } });
  }

  const busy = saving || video.status === "rendering";
  const saveButton = (className?: string) => (
    <Button type="button" variant="outline" className={cn("h-11 rounded-xl", className)} disabled={busy || !isDirty} onClick={() => form.handleSubmit((data) => save(data))()}>
      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      {isDirty ? "Save changes" : "Saved"}
    </Button>
  );

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="grid grid-cols-1 gap-6 pb-36 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:order-2 lg:self-start">
        <ReelPreview ref={previewRef} scene={scene} suspended={video.status === "rendering"} />
        {assets && assets.failed > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {assets.failed} photo{assets.failed === 1 ? "" : "s"} couldn&apos;t be loaded and will show as blank.
          </p>
        )}
        <div id="reel-export">
          <ReelExportPanel
            state={video}
            stale={stale}
            ready={scene !== null && !busy}
            lengthLabel={formatLength(reelDurationSeconds(draft))}
            onCreate={create}
            onCancel={() => abortRef.current?.abort()}
            onShare={share}
          />
        </div>
        <div className="hidden gap-2 lg:flex">
          {saveButton("flex-1")}
          <Button type="button" variant="ghost" className="h-11 rounded-xl" disabled={busy} onClick={startOver}>
            <RotateCcw className="size-4" /> Start over
          </Button>
        </div>
      </aside>

      <div className="min-w-0 space-y-6 lg:order-1">
        {serverError && <FormAlert>{serverError}</FormAlert>}

        <Section title="Slide 1 · Title" hint="Shown first, on your cover photo.">
          <div className="flex gap-2 overflow-x-auto p-1" role="radiogroup" aria-label="Cover photo">
            {images.map((url, i) => {
              const selected = draft.intro.image === url;
              return (
                <button
                  key={url}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Cover photo ${i + 1}`}
                  onClick={() => {
                    form.setValue("intro.image", url, { shouldDirty: true });
                    seekSlide(0);
                  }}
                  className={cn("relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted ring-offset-2 ring-offset-background transition", selected ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100")}
                >
                  <Image src={url} alt="" fill sizes="64px" className="object-cover" />
                  {selected && (
                    <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <FormField id="intro-title" label="Title" error={errors.intro?.title?.message} labelAddon={<Counter value={draft.intro.title} max={90} />}>
            <Input id="intro-title" className="h-11 text-[15px] font-medium" maxLength={90} onFocus={() => seekSlide(0)} {...form.register("intro.title")} />
          </FormField>
          <FormField id="intro-subtitle" label="Line below the title" description="Price and location work well here.">
            <Input id="intro-subtitle" className="h-11" maxLength={100} onFocus={() => seekSlide(0)} {...form.register("intro.subtitle")} />
          </FormField>
        </Section>

        <Section title={`Photo slides (${slides.fields.length})`} hint="One slide per photo. Give each a short title, or leave it empty for just the photo.">
          {slides.fields.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No photo slides — add photos below.</p>}
          <ol className="space-y-2.5">
            {slides.fields.map((field, i) => (
              <li key={field.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                <button type="button" onClick={() => seekSlide(i + 1)} className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted" aria-label={`Preview slide ${i + 2}`}>
                  <Image src={field.image} alt="" fill sizes="64px" className="object-cover" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor={`slide-${i}`} className="text-xs font-medium text-muted-foreground">
                      Slide {i + 2} title
                    </label>
                    <Counter value={draft.slides[i]?.title ?? ""} max={70} />
                  </div>
                  <Input id={`slide-${i}`} className="h-10" maxLength={70} placeholder="No text — photo only" onFocus={() => seekSlide(i + 1)} {...form.register(`slides.${i}.title`)} />
                </div>
                <div className="flex shrink-0 flex-col sm:flex-row">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => slides.move(i, i - 1)}>
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton label="Move down" disabled={i === slides.fields.length - 1} onClick={() => slides.move(i, i + 1)}>
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton label="Remove slide" onClick={() => slides.remove(i)}>
                    <X className="size-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ol>
          {unused.length > 0 && slides.fields.length < MAX_REEL_SLIDES && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Add a photo</p>
              <div className="flex flex-wrap gap-2">
                {unused.map((url) => (
                  <button key={url} type="button" onClick={() => slides.append({ image: url, title: "" })} className="group relative size-16 overflow-hidden rounded-xl bg-muted" aria-label="Add this photo as a slide">
                    <Image src={url} alt="" fill sizes="64px" className="object-cover opacity-80 transition group-hover:opacity-100" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                      <Plus className="size-5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <FormField id="duration" label="Time per slide" className="max-w-48">
            <Controller
              control={form.control}
              name="secondsPerSlide"
              render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger id="duration" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d} seconds
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </Section>

        <Section title="Last slide · WhatsApp" hint="Tells viewers how to reach you. Your property ID is shown too.">
          <FormField id="outro-title" label="Heading">
            <Input id="outro-title" className="h-11" maxLength={70} onFocus={() => seekSlide(timeline.length - 1)} {...form.register("outro.title")} />
          </FormField>
          <FormField id="outro-subtitle" label="Contact line">
            <Input id="outro-subtitle" className="h-11" maxLength={90} onFocus={() => seekSlide(timeline.length - 1)} {...form.register("outro.subtitle")} />
          </FormField>
        </Section>

        <Section
          title="Caption"
          hint="Posted with the reel on Instagram. Edit it freely."
          addon={
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => form.setValue("caption", defaults.caption, { shouldDirty: true })}>
                <RotateCcw className="size-3.5" /> Reset
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={copyCaption}>
                {captionCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {captionCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          }
        >
          <FormField id="caption" label={<span className="sr-only">Caption</span>} error={errors.caption?.message} labelAddon={<Counter value={draft.caption} max={INSTAGRAM_CAPTION_LIMIT} />}>
            <Textarea id="caption" rows={12} className="text-[15px] leading-relaxed" {...form.register("caption")} />
          </FormField>
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 flex gap-2 border-t bg-background/95 p-3 backdrop-blur-md lg:hidden">
        {saveButton("flex-1")}
        <Button type="button" className="h-11 flex-1 rounded-xl" disabled={!scene || busy} onClick={create}>
          {video.status === "rendering" && <Loader2 className="size-4 animate-spin" />}
          Create video
        </Button>
      </div>
    </form>
  );
}

function Section({ title, hint, addon, children }: { title: string; hint?: string; addon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {addon}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.9;
  return (
    <span className={cn("text-xs tabular-nums", near ? "text-amber-600" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  );
}

function IconButton({ label, children, ...props }: { label: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={label} title={label} {...props}>
      {children}
    </Button>
  );
}
