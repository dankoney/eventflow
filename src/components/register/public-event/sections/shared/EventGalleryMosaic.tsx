"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type GalleryMosaicItem = {
  id: string;
  imageUrl: string;
  caption: string | null;
};

type Props = {
  items: GalleryMosaicItem[];
  eventName?: string;
  maxSlots?: number;
};

const DEFAULT_SLOTS = 8;

function captionLines(caption: string | null): { title: string; subtitle?: string } | null {
  if (!caption?.trim()) return null;
  const parts = caption.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return { title: parts[0], subtitle: parts[1] };
}

/** Full-bleed 2×4 mosaic with lightbox — shared by Template 1 and Template 2 galleries. */
export function EventGalleryMosaic({ items, eventName, maxSlots = DEFAULT_SLOTS }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i == null ? null : (i - 1 + items.length) % items.length));
  }, [items.length]);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i == null ? null : (i + 1) % items.length));
  }, [items.length]);

  useEffect(() => {
    if (lightboxIndex == null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

  const onLightboxTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onLightboxTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || items.length < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goNext();
    else goPrev();
    touchStartX.current = null;
  };

  if (items.length === 0) return null;

  const displayItems = items.slice(0, maxSlots);
  const active = lightboxIndex != null ? items[lightboxIndex] : null;

  return (
    <>
      <div className="pe-gallery-mosaic w-full overflow-hidden">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const overlay = isLast ? captionLines(item.caption) : null;
          const globalIndex = items.findIndex((g) => g.id === item.id);

          return (
            <button
              key={item.id}
              type="button"
              className="pe-gallery-tile group relative block aspect-[4/3] w-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pe-accent,#0f172a)]"
              onClick={() => setLightboxIndex(globalIndex >= 0 ? globalIndex : index)}
              aria-label={item.caption?.split("\n")[0]?.trim() || `View gallery image ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {overlay ? (
                <div className="pe-gallery-tile-overlay absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/75 px-4 text-center">
                  <p className="text-lg font-bold leading-tight text-white sm:text-xl md:text-2xl">
                    {overlay.title}
                  </p>
                  {overlay.subtitle ? (
                    <p className="mt-1 text-sm font-medium text-white/85 sm:text-base">{overlay.subtitle}</p>
                  ) : eventName ? (
                    <p className="mt-1 text-sm font-medium text-white/75 sm:text-base">{eventName}</p>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {active && lightboxIndex != null ? (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto bg-black/92 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Gallery image ${lightboxIndex + 1} of ${items.length}`}
          onClick={closeLightbox}
          onTouchStart={onLightboxTouchStart}
          onTouchEnd={onLightboxTouchEnd}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="fixed right-4 top-4 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg transition hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {items.length > 1 ? (
            <>
              <button
                type="button"
                className="pe-gallery-lightbox-nav pe-gallery-lightbox-nav--prev fixed z-[70]"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                className="pe-gallery-lightbox-nav pe-gallery-lightbox-nav--next fixed z-[70]"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
              <p className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold tabular-nums text-white/90">
                {lightboxIndex + 1} / {items.length}
              </p>
            </>
          ) : null}
          <div className="flex min-h-full w-full items-center justify-center p-4 pb-20 pt-16">
            <div
              className="relative flex w-full max-w-6xl flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={active.id}
                src={active.imageUrl}
                alt={active.caption ?? ""}
                className="max-h-[min(85dvh,820px)] w-auto max-w-full object-contain"
              />
              {active.caption ? (
                <p className="mt-4 max-w-2xl text-center text-sm text-white/90 sm:text-base">
                  {active.caption.replace(/\n/g, " · ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
