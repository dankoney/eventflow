"use client";

import type { PublicEventSectionHeaderCopy, PublicEventSectionHeaderKey } from "@/lib/public-event/sectionHeaders";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const areaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

type Props = {
  sectionKey: PublicEventSectionHeaderKey;
  payload: PublicEventExperiencePayload;
  readOnly: boolean;
  onChange: (next: PublicEventExperiencePayload) => void;
  className?: string;
  /** Shown above fields — e.g. "Section heading (optional)" */
  heading?: string;
};

export function PublicEventSectionHeaderFields({
  sectionKey,
  payload,
  readOnly,
  onChange,
  className,
  heading = "Section heading (optional)"
}: Props) {
  const copy: PublicEventSectionHeaderCopy = {
    badge: payload.sectionHeaders?.[sectionKey]?.badge ?? null,
    title: payload.sectionHeaders?.[sectionKey]?.title ?? null,
    description: payload.sectionHeaders?.[sectionKey]?.description ?? null
  };

  function patch(field: "badge" | "title" | "description", value: string) {
    onChange({
      ...payload,
      sectionHeaders: {
        ...payload.sectionHeaders,
        [sectionKey]: {
          badge: copy.badge ?? null,
          title: copy.title ?? null,
          description: copy.description ?? null,
          [field]: value.trim() ? value : null
        }
      }
    });
  }

  return (
    <div className={cn("space-y-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 p-3", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{heading}</p>
      <input
        className={fieldClass}
        placeholder="Eyebrow badge (optional)"
        value={copy.badge ?? ""}
        disabled={readOnly}
        onChange={(e) => patch("badge", e.target.value)}
      />
      <input
        className={fieldClass}
        placeholder="Section title (leave blank to hide heading)"
        value={copy.title ?? ""}
        disabled={readOnly}
        onChange={(e) => patch("title", e.target.value)}
      />
      <textarea
        rows={2}
        className={areaClass}
        placeholder="Section description (optional — leave blank to hide)"
        value={copy.description ?? ""}
        disabled={readOnly}
        onChange={(e) => patch("description", e.target.value)}
      />
    </div>
  );
}
