/**
 * Color helpers for keeping brand colors readable across light and dark themes.
 *
 * The public event page lets organizers pick any brand color. On a dark surface,
 * deep colors like `#120575` (a navy purple) are essentially invisible — text in
 * that color disappears, and a button using it sits below the surface contrast.
 *
 * `readableAccentForDarkBg()` lifts the lightness of a too-dark color into a
 * visible band while keeping the original hue, so the brand still feels right.
 * If the input is already bright enough, it's returned unchanged.
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function expandShortHex(s: string): string {
  return s
    .split("")
    .map((c) => c + c)
    .join("");
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$/.test(m) && !/^[0-9a-fA-F]{6}$/.test(m)) return null;
  const full = m.length === 3 ? expandShortHex(m) : m;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rN:
      h = (gN - bN) / d + (gN < bN ? 6 : 0);
      break;
    case gN:
      h = (bN - rN) / d + 2;
      break;
    case bN:
      h = (rN - gN) / d + 4;
      break;
  }
  return { h: h / 6, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  };
}

/** WCAG-style relative luminance in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/**
 * Returns a hex color that is bright enough to read on a dark background.
 * Keeps the hue and saturation of the input; only lifts lightness if needed.
 *
 * @param hex - input brand color (#rrggbb or #rgb)
 * @param minLightness - minimum HSL lightness in [0,1]; default `0.62`
 * @param boostSaturation - if true, gently bumps saturation when lifting; default `true`
 */
export function readableAccentForDarkBg(
  hex: string,
  minLightness = 0.62,
  boostSaturation = true
): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (l >= minLightness) return rgbToHex(rgb.r, rgb.g, rgb.b);
  const newS = boostSaturation ? Math.min(1, s + 0.1) : s;
  const newRgb = hslToRgb(h, newS, minLightness);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Returns a hex color dark enough to read on light backgrounds (text, borders, icons).
 * Keeps hue; lowers lightness when the brand is very bright (e.g. neon yellow).
 */
export function readableAccentForLightBg(hex: string, maxLightness = 0.4): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (l <= maxLightness) return rgbToHex(rgb.r, rgb.g, rgb.b);
  const newS = Math.max(0.45, Math.min(1, s));
  const newRgb = hslToRgb(h, newS, maxLightness);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Returns either `#ffffff` or `#0f172a` based on the given background color so
 * that text remains readable. Useful for picking text color on top of an
 * accent-colored button when the brand color can be anywhere on the spectrum.
 */
export function readableTextOn(bgHex: string): "#ffffff" | "#0f172a" {
  return relativeLuminance(bgHex) > 0.55 ? "#0f172a" : "#ffffff";
}
