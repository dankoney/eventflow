/**
 * Responsive heading scale for program titles (esp. public hero when there is no banner image).
 * Longer names use smaller type so they still fit in the hero.
 */
export function publicEventTitleClasses(
  name: string
): { title: string; isLong: boolean } {
  const n = (name || "").length;
  if (n <= 28) {
    return { title: "text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl", isLong: false };
  }
  if (n <= 52) {
    return { title: "text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl", isLong: false };
  }
  if (n <= 88) {
    return { title: "text-2xl font-bold leading-[1.15] sm:text-3xl md:text-4xl", isLong: true };
  }
  if (n <= 130) {
    return { title: "text-xl font-semibold leading-snug sm:text-2xl md:text-3xl", isLong: true };
  }
  return { title: "text-lg font-semibold leading-snug sm:text-xl md:text-2xl", isLong: true };
}

/**
 * Smaller scale for dashboard event cards (16:10 hero area).
 */
export function eventCardTitleClasses(name: string): { title: string; isLong: boolean } {
  const n = (name || "").length;
  if (n <= 22) {
    return { title: "text-lg font-bold tracking-tight sm:text-xl", isLong: false };
  }
  if (n <= 48) {
    return { title: "text-base font-bold leading-tight sm:text-lg", isLong: false };
  }
  if (n <= 85) {
    return { title: "text-sm font-semibold leading-snug sm:text-base", isLong: true };
  }
  return { title: "text-xs font-semibold leading-snug sm:text-sm", isLong: true };
}
