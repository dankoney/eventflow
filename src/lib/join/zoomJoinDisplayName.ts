/**
 * Label shown in Zoom when joining via Eventflow gateway (`uname` on join URLs).
 * Matches webinar registrant intent: guest name + (company from registration, else workspace).
 */
export function guestZoomJoinDisplayLabel(
  guestName: string,
  guestCompany: string | null | undefined,
  workspaceOrganizationName: string
): string {
  const org = guestCompany?.trim() || workspaceOrganizationName.trim() || "";
  const name = guestName.trim() || "Guest";
  const full = org ? `${name} (${org})` : name;
  return full.slice(0, 128);
}

/**
 * Appends Zoom’s `uname` query parameter so the web / desktop join flow can pre-fill display name.
 * Skips non-Zoom URLs and URLs that already set `uname`.
 */
export function appendZoomJoinUrlDisplayName(joinUrl: string, displayLabel: string): string {
  const label = displayLabel.trim();
  if (!label) return joinUrl;
  try {
    const u = new URL(joinUrl);
    const host = u.hostname.toLowerCase();
    if (!host.includes("zoom.")) return joinUrl;
    if (u.searchParams.has("uname")) return joinUrl;
    u.searchParams.set("uname", label);
    return u.toString();
  } catch {
    return joinUrl;
  }
}
