"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PropertyImage } from "@/components/shared/property-image";
import type { PropertyType } from "@/lib/domain/property";

/** Mobile: swipeable carousel. Desktop: mosaic + full-screen viewer. */
export function Gallery({ images, title, type }: { images: string[]; title: string; type: PropertyType }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [slide, setSlide] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setSlide(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  if (images.length === 0) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl sm:aspect-[21/9]">
        <PropertyImage alt={title} type={type} />
      </div>
    );
  }

  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  return (
    <>
      {/* Mobile carousel */}
      <div className="relative -mx-4 sm:hidden">
        <div ref={track} className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto">
          {images.map((src, i) => (
            <button key={src} type="button" onClick={() => show(i)} className="relative aspect-[4/3] w-full shrink-0 snap-center" aria-label={`View photo ${i + 1}`}>
              <Image src={src} alt={`${title} — photo ${i + 1}`} fill sizes="100vw" preload={i === 0} loading={i === 0 ? undefined : "lazy"} className="object-cover" />
            </button>
          ))}
        </div>
        <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
          {slide + 1} / {images.length}
        </span>
      </div>

      {/* Desktop mosaic */}
      <div className="relative hidden gap-2 overflow-hidden rounded-2xl sm:grid sm:aspect-[21/9] sm:grid-cols-4 sm:grid-rows-2">
        {images.slice(0, 5).map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => show(i)}
            className={i === 0 ? "relative col-span-2 row-span-2 overflow-hidden" : images.length <= 3 && i > 0 ? "relative col-span-2 overflow-hidden" : "relative overflow-hidden"}
            aria-label={`View photo ${i + 1}`}
          >
            <Image src={src} alt={`${title} — photo ${i + 1}`} fill sizes={i === 0 ? "50vw" : "25vw"} preload={i === 0} className="object-cover transition-transform duration-500 hover:scale-[1.02]" />
          </button>
        ))}
        {images.length > 1 && (
          <button type="button" onClick={() => show(0)} className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-background/95 px-3 py-1.5 text-sm font-medium shadow-soft">
            <Images className="size-4" /> View all {images.length} photos
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(1100px,96vw)] border-0 bg-black p-0 sm:max-w-[min(1100px,96vw)]" showCloseButton>
          <DialogTitle className="sr-only">{title} photos</DialogTitle>
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
            <Image src={images[index]!} alt={`${title} — photo ${index + 1}`} fill sizes="96vw" className="object-contain" />
            {images.length > 1 && (
              <>
                <button type="button" aria-label="Previous photo" onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" aria-label="Next photo" onClick={() => setIndex((i) => (i + 1) % images.length)} className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-black">
              {index + 1} / {images.length}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
