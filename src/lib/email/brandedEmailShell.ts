/**
 * Shared dark-themed email shell used by all branded transactional emails
 * (invitation, RSVP confirmation, registration confirmation, removal notice…).
 *
 * Design language: black surface (#000), rounded card with subtle border,
 * centered org logo / initials, uppercase org name, Manrope headline, Inter
 * body, white inner content cards, and an uppercase footer caption.
 *
 * Each email composes its own `bodyHtml` (typically a stack of white inner
 * cards built with the helpers in this file) and passes it to
 * {@link renderBrandedEmailShell}. The shell renders the doctype, outer
 * wrapping table, header, headline + lede, body, and footer.
 */

import { resolveEmailBrandLogoUrl } from "@/lib/url";

const DEFAULT_PRIMARY = "#22d3ee";

/** Public input for the outer shell renderer. */
export type BrandedEmailShellParams = {
  /** Preview text shown by inbox previews (Gmail / Outlook). */
  preheader: string;
  /** <title> tag — usually the email subject. */
  title: string;

  /** Org branding. */
  orgName: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;

  /** Big H1 headline shown above the lede paragraph. */
  headline: string;
  /** Optional paragraph copy under the headline. */
  lede?: string | null;

  /**
   * Pre-rendered HTML inserted between the lede and the footer. Most callers
   * stack one or more {@link renderEmailCard} / {@link renderEmailCallout}
   * blocks, separated by `<tr><td style="height:16px;...">&nbsp;</td></tr>`
   * spacers.
   */
  bodyHtml: string;

  /**
   * Uppercase caption rendered above the "Sent by X via Eventflow" line.
   * Defaults to `null` (no caption).
   */
  footerCaption?: string | null;

  /** When false, footer says "Sent by {orgName}." instead. */
  showPoweredByEventflow?: boolean;
};

export function renderBrandedEmailShell(p: BrandedEmailShellParams): string {
  const accent = sanitizeHexColor(p.brandPrimaryColor) ?? DEFAULT_PRIMARY;
  const accentText = pickContrastTextColor(accent);
  const logoUrl = resolveEmailBrandLogoUrl({
    eventBrandLogoUrl: p.brandLogoUrl,
    orgLogoUrl: p.orgLogoUrl,
    orgDefaultBrandLogoUrl: p.orgDefaultBrandLogoUrl
  });
  const orgBlock = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(p.orgName)}" width="48" height="48" style="display:inline-block;border-radius:12px;object-fit:cover;background:#0a0a0a"/>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:${accent};color:${accentText};font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-size:20px">${escapeHtml(initials(p.orgName))}</span>`;

  const lede = p.lede?.trim()
    ? `<p style="margin:12px 0 0;color:#a1a1aa;font-size:14px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(p.lede.trim())}</p>`
    : "";

  const footerCaption = p.footerCaption?.trim()
    ? `<p style="margin:0;color:#71717a;font-size:11px;line-height:1.6;letter-spacing:0.08em;font-family:'Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(p.footerCaption.trim())}</p>`
    : "";

  const showPowered = p.showPoweredByEventflow ?? true;
  const senderLine = showPowered
    ? `Sent by ${escapeHtml(p.orgName)} via Eventflow.`
    : `Sent by ${escapeHtml(p.orgName)}.`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark light"/><title>${escapeHtml(p.title)}</title></head>
<body style="margin:0;padding:0;background:#000;color:#e4e4e7;font-family:'Inter','Manrope',Helvetica,Arial,sans-serif">
  <span style="display:none;font-size:0;color:transparent;line-height:0;max-height:0;max-width:0;overflow:hidden">${escapeHtml(p.preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#000">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#000;border:1px solid #18181b;border-radius:24px">
        <tr><td align="center" style="padding:32px 24px 8px">
          ${orgBlock}
          <p style="margin:12px 0 0;color:#71717a;font-size:11px;letter-spacing:0.18em;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(p.orgName)}</p>
        </td></tr>
        <tr><td align="center" style="padding:24px 24px 0;border-top:1px solid #18181b">
          <h1 style="margin:32px 0 0;color:#ffffff;font-size:30px;line-height:1.15;letter-spacing:-0.02em;font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(p.headline)}</h1>
          ${lede}
        </td></tr>
        <tr><td style="height:24px;line-height:24px;font-size:0">&nbsp;</td></tr>
        <tr><td align="center" style="padding:0 24px">${p.bodyHtml}</td></tr>
        <tr><td align="center" style="padding:32px 32px 24px;border-top:1px solid #18181b;margin-top:24px">
          ${footerCaption}
          <p style="margin:${footerCaption ? "14px" : "0"} 0 0;color:#52525b;font-size:11px;letter-spacing:0.08em;font-family:'Inter',Helvetica,Arial,sans-serif">${senderLine}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Common props for the inner content cards used inside the shell body. */
export type EmailCardParams = {
  /** Optional uppercase eyebrow rendered above the title (e.g. "VIRTUAL JOIN LINK"). */
  eyebrow?: string | null;
  /** Optional bold title rendered above the body. */
  title?: string | null;
  /** Optional subtitle directly under the title. */
  subtitle?: string | null;
  /** Pre-rendered HTML body of the card. */
  bodyHtml?: string;
  /** Whether to center the card contents (default true). */
  center?: boolean;
};

/**
 * Renders a white inner card with the supplied eyebrow / title / subtitle /
 * body. Use this for almost every section inside an email body (event
 * details, Zoom join card, attendance note, etc.).
 */
export function renderEmailCard(p: EmailCardParams): string {
  const align = p.center === false ? "left" : "center";
  const titleAlign = p.center === false ? "left" : "center";
  const eyebrow = p.eyebrow?.trim()
    ? `<p style="margin:0;color:#0a0a0a;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;text-align:${titleAlign}">${escapeHtml(p.eyebrow.trim())}</p>`
    : "";
  const title = p.title?.trim()
    ? `<p style="margin:${eyebrow ? "10px" : "0"} 0 0;color:#0a0a0a;font-size:18px;line-height:1.3;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;text-align:${titleAlign}">${escapeHtml(p.title.trim())}</p>`
    : "";
  const subtitle = p.subtitle?.trim()
    ? `<p style="margin:8px 0 0;color:#3f3f46;font-size:13px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif;text-align:${titleAlign}">${escapeHtml(p.subtitle.trim())}</p>`
    : "";
  const body = p.bodyHtml ?? "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:18px"><tr><td align="${align}" style="padding:22px 24px">${eyebrow}${title}${subtitle}${body}</td></tr></table>`;
}

/** Vertical spacer for stacking inner cards. */
export const EMAIL_CARD_SPACER = `<tr><td style="height:16px;line-height:16px;font-size:0">&nbsp;</td></tr>`;

/** Wraps multiple section HTML strings in a vertical stack (with spacers). */
export function stackEmailSections(...sections: Array<string | false | null | undefined>): string {
  const used = sections.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  if (used.length === 0) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td>${used.join(
    `</td></tr>${EMAIL_CARD_SPACER}<tr><td>`
  )}</td></tr></table>`;
}

/** Renders a primary pill CTA inside a card or callout. */
export function renderCtaButton(params: {
  href: string;
  label: string;
  accent: string;
  variant?: "primary" | "secondary";
}): string {
  const accent = sanitizeHexColor(params.accent) ?? DEFAULT_PRIMARY;
  if (params.variant === "secondary") {
    return `<a href="${escapeAttr(params.href)}" style="display:inline-block;padding:12px 22px;background:transparent;color:#ffffff;text-decoration:none;border:1px solid #ffffff;border-radius:10px;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(params.label)}</a>`;
  }
  const accentText = pickContrastTextColor(accent);
  return `<a href="${escapeAttr(params.href)}" style="display:inline-block;padding:12px 22px;background:${accent};color:${accentText};text-decoration:none;border-radius:10px;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(params.label)}</a>`;
}

/**
 * Renders an inline event details inner card (date + location) for use inside
 * the shell body. `locationLine` is omitted (whole row) when null / empty.
 */
export function renderEventDetailsCard(params: {
  eventName: string;
  eventDateLabel: string;
  locationLine?: string | null;
  directionsUrl?: string | null;
  accent: string;
}): string {
  const accent = sanitizeHexColor(params.accent) ?? DEFAULT_PRIMARY;
  const directionsLink = params.directionsUrl
    ? ` · <a href="${escapeAttr(params.directionsUrl)}" style="color:${accent};font-weight:600;text-decoration:none">Get Directions ↗</a>`
    : "";
  const locationLine = params.locationLine?.trim()
    ? `<p style="margin:6px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif;text-align:center">📍 ${escapeHtml(params.locationLine.trim())}${directionsLink}</p>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:18px"><tr><td align="center" style="padding:24px">
    <p style="margin:0;color:#0a0a0a;font-size:18px;line-height:1.3;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(params.eventName)}</p>
    <p style="margin:10px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">📅 ${escapeHtml(params.eventDateLabel)}</p>
    ${locationLine}
  </td></tr></table>`;
}

/** Util — used by sub-templates for safe HTML interpolation. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

export function sanitizeHexColor(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`;
  return null;
}

export function pickContrastTextColor(hex: string): string {
  const t = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "EV";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "EV";
}

export function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}
