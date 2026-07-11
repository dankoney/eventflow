"use client";

import { FileText, Presentation } from "lucide-react";

import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";

export type SummitSectionVariant = "summit-light" | "summit-dark";

export function resourceHref(row: { fileUrl?: string | null; url?: string | null }) {
  const raw = (row.fileUrl ?? row.url ?? "").trim();
  if (!raw) return "#";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return `/${raw}`;
}

export function contactWebsiteHref(raw: string | null | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) return "#";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) return t;
  return `https://${t}`;
}

export function hasAttendeeContact(c: PublicEventExperiencePayload["contact"] | null | undefined): boolean {
  if (!c) return false;
  return Boolean(
    c.heading?.trim() ||
      c.contactName?.trim() ||
      c.email?.trim() ||
      c.phone?.trim() ||
      c.website?.trim() ||
      c.note?.trim()
  );
}

export function descriptionParagraphs(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const parts = text.trim().split(/\n\n+/);
  return parts.length ? parts : [text.trim()];
}

export function resourceIcon(kind: string, variant: SummitSectionVariant) {
  const k = kind.toUpperCase();
  if (k.includes("PDF"))
    return (
      <span
        className={
          variant === "summit-dark"
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-950/40 text-red-400"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-50 text-red-600"
        }
      >
        <FileText className="h-5 w-5" aria-hidden />
      </span>
    );
  if (k.includes("PPT") || k.includes("SLIDE"))
    return (
      <span
        className={
          variant === "summit-dark"
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded bg-orange-950/40 text-orange-400"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded bg-orange-50 text-orange-600"
        }
      >
        <Presentation className="h-5 w-5" aria-hidden />
      </span>
    );
  return (
    <span
      className={
        variant === "summit-dark"
          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded bg-blue-950/40 text-blue-400"
          : "flex h-10 w-10 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600"
      }
    >
      <FileText className="h-5 w-5" aria-hidden />
    </span>
  );
}
