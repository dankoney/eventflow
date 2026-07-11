import type { EmailSegmentDefinition } from "@/lib/email/segmentDefinition";

export type SavedEmailSegment = {
  id: string;
  name: string;
  /** Segment fields without orgId (re-applied on load). */
  definition: Omit<EmailSegmentDefinition, "orgId">;
  savedAt: string;
};

const STORAGE_PREFIX = "eventflow-email-saved-segments";

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}:${orgId}`;
}

export function listSavedEmailSegments(orgId: string): SavedEmailSegment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedEmailSegment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEmailSegment(orgId: string, name: string, definition: Omit<EmailSegmentDefinition, "orgId">): SavedEmailSegment {
  const segment: SavedEmailSegment = {
    id: crypto.randomUUID(),
    name: name.trim(),
    definition,
    savedAt: new Date().toISOString()
  };
  const existing = listSavedEmailSegments(orgId);
  const next = [segment, ...existing.filter((s) => s.name.toLowerCase() !== segment.name.toLowerCase())];
  window.localStorage.setItem(storageKey(orgId), JSON.stringify(next));
  return segment;
}

export function deleteSavedEmailSegment(orgId: string, id: string): void {
  const next = listSavedEmailSegments(orgId).filter((s) => s.id !== id);
  window.localStorage.setItem(storageKey(orgId), JSON.stringify(next));
}
