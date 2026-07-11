/** Stable gradient for event cards and Open Graph when there is no photo. */
export function heroGradientFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const h2 = (hue + 48) % 360;
  return `linear-gradient(135deg, hsl(${hue} 42% 38%), hsl(${h2} 36% 22%))`;
}

/**
 * Solid fill for Satori/OG (next/og) — the renderer does not reliably support
 * CSS gradients; using them caused truncated responses in production.
 */
export function heroSolidFillForOg(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hAbs = Math.abs(h);
  const r = 55 + (hAbs % 80);
  const g = 45 + ((hAbs >> 5) % 90);
  const b = 90 + ((hAbs >> 10) % 70);
  return `rgb(${r}, ${g}, ${b})`;
}
