export const SPEAKER_GRID_COLUMNS = [2, 3, 4, 5] as const;
export type SpeakerGridColumns = (typeof SPEAKER_GRID_COLUMNS)[number];

export const SPEAKER_HOVER_STYLES = ["none", "zoom", "shadow", "grayscale"] as const;
export type SpeakerHoverStyle = (typeof SPEAKER_HOVER_STYLES)[number];

export const SPEAKER_LAYOUT_MODES = ["grid", "kinetic"] as const;
export type SpeakerLayoutMode = (typeof SPEAKER_LAYOUT_MODES)[number];

export const SPEAKER_HOVER_STYLE_LABELS: Record<SpeakerHoverStyle, string> = {
  none: "No hover effect",
  zoom: "Zoom on hover",
  shadow: "Soft shadow lift",
  grayscale: "Black & white → color"
};

export function speakerGridClass(columns: SpeakerGridColumns, count: number): string {
  const cols = Math.min(columns, Math.max(count, 1));
  const base = "grid gap-6";
  if (count === 1) return `${base} mx-auto max-w-xs grid-cols-1`;
  if (cols === 2) return `${base} grid-cols-1 sm:grid-cols-2`;
  if (cols === 3) return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  if (cols === 4) return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`;
  return `${base} grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`;
}

export function speakerImageHoverClass(hover: SpeakerHoverStyle): string {
  switch (hover) {
    case "zoom":
      return "transition-transform duration-500 group-hover:scale-105";
    case "shadow":
      return "transition-shadow duration-300 group-hover:shadow-[0_12px_40px_color-mix(in_srgb,var(--pe-primary)_25%,transparent)]";
    case "grayscale":
      return "grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-[1.02]";
    default:
      return "";
  }
}

