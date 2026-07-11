"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import type { GalleryMosaicItem } from "../../../sections/shared/EventGalleryMosaic";

type Props = {
  items: GalleryMosaicItem[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/**
 * Gallery carousel — portaled to `document.body` so `position: fixed` is not broken by
 * section scroll-reveal transforms. Page scroll stays enabled (pointer-events-none shell).
 */
export function TechnexusGalleryLightbox({ items, index, onClose, onIndexChange }: Props) {
  const touchStartX = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const active = index != null ? items[index] : null;

  const goPrev = useCallback(() => {
    if (index == null || items.length < 2) return;
    onIndexChange((index - 1 + items.length) % items.length);
  }, [index, items.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (index == null || items.length < 2) return;
    onIndexChange((index + 1) % items.length);
  }, [index, items.length, onIndexChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, goNext, goPrev]);

  if (!mounted || index == null || !active) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || items.length < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goNext();
    else goPrev();
    touchStartX.current = null;
  };

  return createPortal(
    <div
      className="tn-gallery-lightbox pointer-events-none fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="false"
      aria-label={`Gallery image ${index + 1} of ${items.length}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="tn-gallery-lightbox-backdrop pointer-events-none fixed inset-0 bg-slate-950/75" aria-hidden />

      <button
        type="button"
        onClick={onClose}
        className="tn-gallery-lightbox-close pointer-events-auto fixed right-4 top-4 z-[210] flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition hover:opacity-90"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            className="tn-gallery-lightbox-nav tn-gallery-lightbox-nav--prev pointer-events-auto fixed left-3 top-1/2 z-[210] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg sm:left-6"
            onClick={goPrev}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
          <button
            type="button"
            className="tn-gallery-lightbox-nav tn-gallery-lightbox-nav--next pointer-events-auto fixed right-3 top-1/2 z-[210] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg sm:right-6"
            onClick={goNext}
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
          <p className="tn-gallery-lightbox-counter pointer-events-auto fixed bottom-4 left-1/2 z-[210] -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold tabular-nums shadow-md">
            {index + 1} / {items.length}
          </p>
        </>
      ) : null}

      <div className="pointer-events-none fixed inset-0 z-[205] flex flex-col items-center justify-center px-4 pb-24 pt-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={active.id}
          src={active.imageUrl}
          alt={active.caption ?? ""}
          className="max-h-[min(85dvh,820px)] w-auto max-w-full rounded-lg object-contain shadow-2xl"
        />
        {active.caption ? (
          <p
            className={cn(
              "mt-4 max-w-2xl text-center text-sm sm:text-base",
              "text-slate-200"
            )}
          >
            {active.caption.replace(/\n/g, " · ")}
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
