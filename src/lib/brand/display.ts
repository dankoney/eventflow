/** Client-safe branding display helpers (mirrors feedback email shell). */

export function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "EV";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "EV";
}

export function pickBrandContrastTextColor(hex: string): string {
  const t = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}
