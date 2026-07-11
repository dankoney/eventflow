"use client";

import { useEffect } from "react";

type Props = {
  enabled?: boolean;
};

/**
 * Scroll-driven section reveals on public event pages.
 * Attach `data-pe-scroll-root` on the template wrapper.
 */
export function PublicPageScrollEffects({ enabled = true }: Props) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const root = document.querySelector<HTMLElement>("[data-pe-scroll-root]");
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sections = root.querySelectorAll<HTMLElement>("section[id]");
    const isTechnexus = root.classList.contains("pe-theme-technexus");
    const staggerMs = isTechnexus ? 70 : 50;
    const maxDelay = isTechnexus ? 280 : 200;

    sections.forEach((el, index) => {
      el.classList.add("pe-scroll-reveal");
      el.style.setProperty("--pe-scroll-delay", `${Math.min(index * staggerMs, maxDelay)}ms`);
      if (reduced) el.classList.add("pe-scroll-visible");
    });

    let io: IntersectionObserver | null = null;
    if (!reduced) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("pe-scroll-visible");
              io?.unobserve(entry.target);
            }
          });
        },
        { rootMargin: isTechnexus ? "0px 0px -8% 0px" : "0px 0px -10% 0px", threshold: 0.08 }
      );
      sections.forEach((el) => io?.observe(el));
    }

    let raf = 0;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
        const progress = Math.min(1, window.scrollY / maxScroll);
        root.style.setProperty("--pe-scroll-progress", String(progress));
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      root.style.removeProperty("--pe-scroll-progress");
    };
  }, [enabled]);

  return null;
}
