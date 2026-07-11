import type { CSSProperties } from "react";

import type { PublicEventExperiencePayload } from "./experience";

export type SpeakersDisplayConfig = PublicEventExperiencePayload["speakersDisplay"];

/** Default hex values shown in pickers and used when no custom color is saved. */
export const SPEAKER_TEXT_COLOR_DEFAULTS = {
  name: "#f1f5f9",
  title: "#3b82f6",
  company: "#f1f5f9",
  bio: "#94a3b8",
  social: "#3b82f6",
  kineticTitle: "#ffffff"
} as const;

export type SpeakerTextColorKey = keyof typeof SPEAKER_TEXT_COLOR_DEFAULTS;

const FIELD_MAP = {
  name: "nameColor",
  title: "titleColor",
  company: "companyColor",
  bio: "bioColor",
  social: "socialColor"
} as const satisfies Record<Exclude<SpeakerTextColorKey, "kineticTitle">, keyof SpeakersDisplayConfig>;

type ResolvedColor = { style?: CSSProperties; className?: string };

function resolveColor(
  custom: string | null | undefined,
  fallbackClass: string
): ResolvedColor {
  if (custom?.trim()) {
    return { style: { color: custom.trim() } };
  }
  return { className: fallbackClass };
}

const FALLBACK_CLASSES = {
  name: "text-[var(--pe-on-surface)]",
  title: "text-[color:var(--pe-primary)]",
  company: "text-[var(--pe-on-surface)]",
  bio: "text-[var(--pe-on-surface-variant)]",
  social: "text-[color:var(--pe-primary)]",
  kineticTitle: "text-white/90"
} as const;

export function speakerTextColors(display?: SpeakersDisplayConfig | null) {
  return {
    name: resolveColor(display?.nameColor, FALLBACK_CLASSES.name),
    title: resolveColor(display?.titleColor, FALLBACK_CLASSES.title),
    company: resolveColor(display?.companyColor, FALLBACK_CLASSES.company),
    bio: resolveColor(display?.bioColor, FALLBACK_CLASSES.bio),
    social: resolveColor(display?.socialColor, FALLBACK_CLASSES.social),
    kineticTitle: resolveColor(display?.titleColor, FALLBACK_CLASSES.kineticTitle)
  };
}

export function speakerDisplayColorKey(key: Exclude<SpeakerTextColorKey, "kineticTitle">) {
  return FIELD_MAP[key];
}
