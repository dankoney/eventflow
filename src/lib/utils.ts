import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize server-serialized date strings back to Date for client components. */
export function coerceDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(date: Date | string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));
}

export function formatEventPeriod(
  start: Date | string,
  end: Date | string,
  locale = "en-US"
) {
  const a = new Date(start);
  const b = new Date(end);
  const sameDay =
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay) {
    const day = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(a);
    const tA = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(a);
    const tB = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(b);
    return `${day} · ${tA} - ${tB}`;
  }
  const s = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(a);
  const e = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(b);
  return `${s} → ${e}`;
}

/** Value for `<input type="datetime-local" />` in local time. */
export function formatDatetimeLocalValue(d: Date | string): string {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function formatLocationLine(loc: { name: string; address: string }): string {
  const n = loc.name.trim();
  const a = loc.address.trim();
  if (n && a) return `${n} — ${a}`;
  return n || a || "Venue TBD";
}

export function truncate(value: string, max = 80) {
  if (value.length > max) return `${value.slice(0, max - 1)}...`;
  return value;
}

/** URL-safe workspace slug from a display name (lowercase, hyphens). */
export function slugifyWorkspaceName(input: string, max = 60): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return s.length > 0 ? s : "workspace";
}
