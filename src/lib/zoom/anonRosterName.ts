/** Stored display string from Zoom participant report for name-only joiners. */
export const ZOOM_ANON_NAME_RE = /^Anonymous Zoom Participant \((.*)\)\s*$/i;

export function isZoomSyntheticAnonEmail(email: string | null | undefined) {
  if (!email?.trim()) return false;
  const e = email.trim().toLowerCase();
  return e.includes("zoom-anon-") && e.endsWith("@external.eventflow");
}

/**
 * Roster "Name" should show the Zoom display text when the record used
 * `Anonymous Zoom Participant (Display)`; anonymous status is shown separately.
 */
export function parseZoomAnonRosterName(name: string, email: string | null | undefined) {
  const m = name.match(ZOOM_ANON_NAME_RE);
  const inner = m?.[1]?.trim() ?? "";
  const synthetic = isZoomSyntheticAnonEmail(email);
  const isAnonymous = Boolean(m) || synthetic;
  if (m) {
    return { isAnonymous, displayName: inner || name.trim() || "—" };
  }
  if (synthetic) {
    const stripped = name
      .replace(/^\s*Anonymous Zoom Participant\s*\(/i, "")
      .replace(/\)\s*$/, "")
      .trim();
    return { isAnonymous: true, displayName: stripped || name.trim() || "—" };
  }
  return { isAnonymous: false, displayName: name.trim() || "—" };
}
