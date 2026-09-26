"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { MAX_UPLOAD_BYTES, prepareImageForUpload } from "@/lib/image-compress";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 20;
const CONCURRENCY = 3;

interface Pending {
  id: string;
  preview: string;
  progress: number;
  error?: string;
}

function uploadFile(file: File, onProgress: (pct: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    xhr.open("POST", "/api/media/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body?.error?.message ?? "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection"));
    xhr.send(form);
  });
}

/** Property photo manager. The first image is the cover shown on cards and link previews. */
export function ImageUploader({ value, onChange, disabled }: { value: string[]; onChange: (urls: string[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const room = MAX_IMAGES - valueRef.current.length - pending.filter((p) => !p.error).length;
      const accepted = Array.from(files).slice(0, Math.max(0, room));
      const queue: { file: File; item: Pending }[] = accepted.map((file) => ({
        file,
        item: {
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          preview: URL.createObjectURL(file),
          progress: 0,
          error: !file.type.startsWith("image/") ? "Not an image" : undefined,
        },
      }));
      setPending((prev) => [...prev, ...queue.map((q) => q.item)]);

      // Upload in parallel, but commit results in the order the broker selected them
      // so the first chosen photo becomes the cover.
      const work = queue.filter((q) => !q.item.error).map((q, index) => ({ ...q, index }));
      const results: (string | null | undefined)[] = new Array(work.length);
      let committed = 0;
      const flush = () => {
        const ready: string[] = [];
        const doneIds: string[] = [];
        while (committed < results.length && results[committed] !== undefined) {
          const url = results[committed];
          if (url) {
            ready.push(url);
            doneIds.push(work[committed]!.item.id);
            URL.revokeObjectURL(work[committed]!.item.preview);
          }
          committed++;
        }
        if (ready.length) {
          const updated = [...valueRef.current, ...ready];
          valueRef.current = updated;
          onChange(updated);
          setPending((prev) => prev.filter((p) => !doneIds.includes(p.id)));
        }
      };
      const remaining = [...work];
      const run = async () => {
        for (let next = remaining.shift(); next; next = remaining.shift()) {
          const { file, item, index } = next;
          try {
            const prepared = await prepareImageForUpload(file);
            if (prepared.size > MAX_UPLOAD_BYTES) throw new Error("Photo is too large — try a smaller one");
            const { url } = await uploadFile(prepared, (progress) => setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, progress } : p))));
            results[index] = url;
          } catch (error) {
            results[index] = null;
            setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, error: error instanceof Error ? error.message : "Upload failed" } : p)));
          }
          flush();
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, run));
    },
    [onChange, pending],
  );

  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    onChange(next);
  };

  const full = value.length >= MAX_IMAGES;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {value.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <Image src={url} alt={`Property photo ${i + 1}`} fill sizes="160px" className="object-cover" />
            {i === 0 && <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white"><Star className="size-2.5 fill-current" /> Cover</span>}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <div className="flex gap-1">
                <IconBtn label="Move left" disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                  <ArrowLeft className="size-3.5" />
                </IconBtn>
                <IconBtn label="Move right" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)}>
                  <ArrowRight className="size-3.5" />
                </IconBtn>
              </div>
              <IconBtn label="Remove photo" disabled={disabled} onClick={() => onChange(value.filter((u) => u !== url))}>
                <X className="size-3.5" />
              </IconBtn>
            </div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={p.preview} alt="" className={cn("h-full w-full object-cover", !p.error && "opacity-60")} />
            <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-[11px] font-medium", p.error ? "bg-red-50/90 text-red-700" : "text-foreground")}>
              {p.error ? (
                <>
                  <AlertCircle className="size-4" /> {p.error}
                  <button type="button" className="underline" onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}>
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="size-4 animate-spin" /> {p.progress}%
                </>
              )}
            </div>
            {!p.error && <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10"><div className="h-full bg-brand transition-all" style={{ width: `${p.progress}%` }} /></div>}
          </div>
        ))}
        {!full && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 disabled:opacity-50",
              dragging && "border-brand bg-brand-soft text-brand",
              value.length === 0 && pending.length === 0 && "col-span-3 aspect-auto py-8 sm:col-span-4 lg:col-span-5",
            )}
          >
            <ImagePlus className="size-5" />
            {value.length === 0 && pending.length === 0 ? (
              <>
                <span className="text-sm text-foreground">Add property photos</span>
                <span>Tap to choose or drag &amp; drop · JPG, PNG or WebP</span>
              </>
            ) : (
              "Add more"
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        {value.length}/{MAX_IMAGES} photos · The first photo is the cover.
      </p>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex size-7 items-center justify-center rounded-md bg-background/95 text-foreground shadow-soft disabled:opacity-40">
      {children}
    </button>
  );
}
