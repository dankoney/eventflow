"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useRef } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
};

/** Snap-scroll row with optional prev/next controls. */
export function HorizontalScrollCarousel({ children, className, itemClassName }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByPage(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.85, 280);
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70 md:flex"
        aria-label="Previous"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70 md:flex"
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div
        ref={scrollerRef}
        className={cn("flex snap-x gap-6 overflow-x-auto pb-4 pe-no-scrollbar", itemClassName)}
      >
        {children}
      </div>
    </div>
  );
}
