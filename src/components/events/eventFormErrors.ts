import type { FieldErrors, FieldPath, UseFormReturn } from "react-hook-form";

import type { EventFormValues } from "@/components/events/eventFormSchema";

export function firstValidationMessage(errors: FieldErrors<EventFormValues>): string | null {
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const o = node as Record<string, unknown>;
    if (typeof o.message === "string" && o.message) return o.message;
    for (const v of Object.values(o)) {
      const found = walk(v);
      if (found) return found;
    }
    return null;
  };
  return walk(errors);
}

export function sessionRowErrorSummary(errors: FieldErrors<EventFormValues>): string | null {
  const md = errors.multiDayDays;
  if (!md) return null;
  if (Array.isArray(md)) {
    for (let i = 0; i < md.length; i++) {
      const row = md[i];
      if (!row || typeof row !== "object") continue;
      const msg =
        (row.endsAt as { message?: string } | undefined)?.message ||
        (row.startsAt as { message?: string } | undefined)?.message ||
        (row.zoomJoinUrl as { message?: string } | undefined)?.message;
      if (msg) return `Session row ${i + 1}: ${msg}`;
    }
  }
  if (!Array.isArray(md) && typeof md === "object" && "message" in md && typeof md.message === "string") {
    return md.message;
  }
  return null;
}

/** Map server-side multiDayConfig messages like `Day 3: end must be after start.` onto the matching row field. */
export function tryApplyMultiDayServerIssues(form: UseFormReturn<EventFormValues>, errorMessage: string): void {
  const parts = errorMessage.split(";").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const m = /^Day\s+(\d+)\s*:\s*(.+)$/i.exec(part);
    if (!m) continue;
    const n = Number(m[1]);
    const msg = m[2]?.trim();
    if (!Number.isFinite(n) || n < 1 || !msg) continue;
    form.setError(`multiDayDays.${n - 1}.endsAt` as FieldPath<EventFormValues>, { type: "server", message: msg });
  }
}
