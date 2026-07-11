import { resolveEmailAssetUrl, resolveEmailBrandLogoUrl } from "@/lib/url";

/**
 * Smart Invitation email template (Phase 1).
 * Renders a personalized digital invitation with a dual CTA:
 *   - Primary: Secure My Spot (RSVP magic-link page)
 *   - Secondary: I Can't Make It (Decline & Feedback page)
 *
 * Design language: dark surface, centered logo, large Manrope/Inter headline,
 * "surface-container" card with event details.
 */

export type InvitationEmailParams = {
  guestName: string;
  eventName: string;
  /** Pre-formatted human-friendly date (e.g. "November 14, 2026 - 09:00 AM EST"). */
  eventDateLabel: string;
  /** Pre-formatted location string ("San Francisco Innovation Center / Remote Access"). */
  locationLine: string;
  /** Optional short pitch / description copy. */
  hookCopy?: string | null;
  /** Optional pull-quote shown beneath the CTAs. */
  closingQuote?: string | null;
  /** Hosting org branding (defaults applied when null). */
  orgName: string;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
  bannerImageUrl?: string | null;
  brandPrimaryColor?: string | null;
  /** Magic-link URL to the RSVP confirmation page. */
  acceptUrl: string;
  /** Magic-link URL to the decline / feedback page. */
  declineUrl: string;
  /** Optional "Get Directions" Google Maps URL for in-person venues. */
  directionsUrl?: string | null;
  /** Public site URL for footer links (privacy, unsubscribe). */
  siteBaseUrl?: string | null;
  /** When true, footer says "powered by Eventflow". */
  showPoweredByEventflow?: boolean;
};

const DEFAULT_PRIMARY = "#22d3ee";

export function renderInvitationEmailHtml(params: InvitationEmailParams): string {
  const firstName = (params.guestName.trim().split(/\s+/)[0] ?? params.guestName).trim() || "there";
  const accent = sanitizeHexColor(params.brandPrimaryColor) ?? DEFAULT_PRIMARY;
  const accentText = pickContrastTextColor(accent);

  const logoUrl = resolveEmailBrandLogoUrl({
    eventBrandLogoUrl: params.brandLogoUrl,
    orgLogoUrl: params.orgLogoUrl,
    orgDefaultBrandLogoUrl: params.orgDefaultBrandLogoUrl
  });
  const bannerUrl = resolveEmailAssetUrl(params.bannerImageUrl);

  const orgLogoBlock = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(params.orgName)}" width="48" height="48" style="display:inline-block;border-radius:12px;object-fit:cover;background:#0a0a0a"/>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:${accent};color:${accentText};font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;font-size:20px">${escapeHtml(initials(params.orgName))}</span>`;

  const bannerBlock = bannerUrl
    ? `
      <tr>
        <td align="center" style="padding:0 24px">
          <img src="${escapeAttr(bannerUrl)}" alt="${escapeAttr(params.eventName)}" width="528" style="display:block;width:100%;max-width:528px;border-radius:16px;border:1px solid #1f1f23"/>
        </td>
      </tr>
      <tr><td style="height:24px;line-height:24px;font-size:0">&nbsp;</td></tr>`
    : "";

  const hook = params.hookCopy?.trim()
    ? `<p style="margin:12px 0 0;color:#a1a1aa;font-size:14px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">${escapeHtml(params.hookCopy.trim())}</p>`
    : "";

  const closing = params.closingQuote?.trim()
    ? `
      <tr><td style="height:32px;line-height:32px;font-size:0">&nbsp;</td></tr>
      <tr>
        <td align="center" style="padding:0 32px">
          <hr style="border:0;border-top:1px solid #27272a;margin:0;width:48px"/>
          <p style="margin:24px 0 0;color:#a1a1aa;font-style:italic;font-size:14px;line-height:1.55;font-family:'Inter',Helvetica,Arial,sans-serif">"${escapeHtml(params.closingQuote.trim())}"</p>
        </td>
      </tr>`
    : "";

  const directionsLink = params.directionsUrl
    ? ` <a href="${escapeAttr(params.directionsUrl)}" style="color:${accent};font-weight:600;text-decoration:none">Get Directions ↗</a>`
    : "";

  const footerSiteLink = params.siteBaseUrl
    ? `<a href="${escapeAttr(params.siteBaseUrl)}" style="color:#a1a1aa;text-decoration:none">${escapeHtml(stripProtocol(params.siteBaseUrl))}</a>`
    : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="color-scheme" content="dark light"/>
    <title>${escapeHtml(`Invitation: ${params.eventName}`)}</title>
  </head>
  <body style="margin:0;padding:0;background:#000;color:#e4e4e7;font-family:'Inter','Manrope',Helvetica,Arial,sans-serif">
    <span style="display:none;font-size:0;color:transparent;line-height:0;max-height:0;max-width:0;overflow:hidden">You're invited, ${escapeHtml(firstName)} - ${escapeHtml(params.eventName)} on ${escapeHtml(params.eventDateLabel)}</span>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#000">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#000;border:1px solid #18181b;border-radius:24px">
            <tr>
              <td align="center" style="padding:32px 24px 8px">
                ${orgLogoBlock}
                <p style="margin:12px 0 0;color:#71717a;font-size:11px;letter-spacing:0.18em;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">${escapeHtml(params.orgName)}</p>
              </td>
            </tr>
            <tr><td style="height:24px;line-height:24px;font-size:0">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding:0 24px;border-top:1px solid #18181b">
                <h1 style="margin:32px 0 0;color:#ffffff;font-size:32px;line-height:1.15;letter-spacing:-0.02em;font-weight:800;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">You're invited, ${escapeHtml(firstName)}.</h1>
                ${hook}
              </td>
            </tr>
            <tr><td style="height:32px;line-height:32px;font-size:0">&nbsp;</td></tr>
            ${bannerBlock}
            <tr>
              <td align="center" style="padding:0 24px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:18px">
                  <tr>
                    <td align="center" style="padding:24px 24px 22px">
                      <p style="margin:0;color:#0a0a0a;font-size:18px;line-height:1.3;font-weight:700;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">${escapeHtml(params.eventName)}</p>
                      <p style="margin:10px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">
                        <span style="display:inline-block;vertical-align:middle">&#128197;</span>
                        ${escapeHtml(params.eventDateLabel)}
                      </p>
                      <p style="margin:6px 0 0;color:#3f3f46;font-size:13px;font-family:'Inter',Helvetica,Arial,sans-serif">
                        <span style="display:inline-block;vertical-align:middle">&#128205;</span>
                        ${escapeHtml(params.locationLine)}${directionsLink}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height:28px;line-height:28px;font-size:0">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding:0 24px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 6px 8px">
                      <a href="${escapeAttr(params.acceptUrl)}" style="display:inline-block;padding:13px 22px;background:${accent};color:${accentText};text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">Secure My Spot</a>
                    </td>
                    <td style="padding:0 6px 8px">
                      <a href="${escapeAttr(params.declineUrl)}" style="display:inline-block;padding:13px 22px;background:transparent;color:#ffffff;text-decoration:none;border:1px solid #ffffff;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;font-family:'Manrope','Inter',Helvetica,Arial,sans-serif">I Can't Make It</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${closing}
            <tr><td style="height:36px;line-height:36px;font-size:0">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding:24px 32px;border-top:1px solid #18181b">
                <p style="margin:0;color:#71717a;font-size:11px;line-height:1.6;letter-spacing:0.08em;font-family:'Inter',Helvetica,Arial,sans-serif;text-transform:uppercase">This invitation was sent by ${escapeHtml(params.orgName)}${params.showPoweredByEventflow ? " via Eventflow" : ""}.</p>
                ${footerSiteLink ? `<p style="margin:10px 0 0;color:#71717a;font-size:11px;letter-spacing:0.08em;text-transform:uppercase">${footerSiteLink}</p>` : ""}
                <p style="margin:14px 0 0;color:#52525b;font-size:11px;letter-spacing:0.08em;font-family:'Inter',Helvetica,Arial,sans-serif">If you weren't expecting this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "EV";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function sanitizeHexColor(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`;
  return null;
}

function pickContrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0a0a0a" : "#ffffff";
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}
