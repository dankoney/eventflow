import type { DataQualitySeverity, DataQualityTagId } from "@/lib/delivery/dataQuality";
import type { GuestCleanupRow, UnifiedDeliveryRow } from "@/lib/delivery/eventDeliveryReport";

export type DeliveryStatusFilter = "ALL" | "SENT" | "FAILED" | "SKIPPED";
export type DeliveryChannelFilter = "ALL" | "EMAIL" | "SMS";
export type DeliverySourceFilter = "ALL" | "system" | "custom";
export type DeliveryLogSort =
  | "newest"
  | "oldest"
  | "guest_asc"
  | "guest_desc"
  | "issues_first";

export type DeliveryLogFilterState = {
  status: DeliveryStatusFilter;
  channel: DeliveryChannelFilter;
  kind: string;
  source: DeliverySourceFilter;
  eventId: string;
  issuesOnly: boolean;
  sort: DeliveryLogSort;
};

export type CleanupTagFilter = "ALL" | DataQualityTagId;
export type CleanupSeverityFilter = "ALL" | DataQualitySeverity;
export type CleanupFailuresFilter = "ALL" | "with_failures" | "contact_only";
export type CleanupSort = "severity" | "failures_desc" | "guest_asc" | "guest_desc";

export type CleanupFilterState = {
  tag: CleanupTagFilter;
  severity: CleanupSeverityFilter;
  failures: CleanupFailuresFilter;
  sort: CleanupSort;
};

export const DEFAULT_LOG_FILTERS: DeliveryLogFilterState = {
  status: "ALL",
  channel: "ALL",
  kind: "ALL",
  source: "ALL",
  eventId: "ALL",
  issuesOnly: false,
  sort: "newest"
};

export const DEFAULT_CLEANUP_FILTERS: CleanupFilterState = {
  tag: "ALL",
  severity: "ALL",
  failures: "ALL",
  sort: "severity"
};

const SEVERITY_RANK: Record<DataQualitySeverity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3
};

const STATUS_ISSUE_RANK: Record<string, number> = {
  FAILED: 0,
  SKIPPED: 1,
  SENT: 2
};

export function collectDeliveryKindOptions(rows: UnifiedDeliveryRow[]): Array<{ value: string; label: string }> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.kind)) map.set(row.kind, row.kindLabel);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function collectEventOptions(
  rows: Array<{ eventId: string; eventName: string }>
): Array<{ value: string; label: string }> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.eventId)) map.set(row.eventId, row.eventName);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterAndSortDeliveryLog<T extends UnifiedDeliveryRow>(
  rows: T[],
  search: string,
  filters: DeliveryLogFilterState,
  extraHay?: (row: T) => string[]
): T[] {
  const q = search.trim().toLowerCase();

  let out = rows.filter((row) => {
    if (filters.status !== "ALL" && row.status !== filters.status) return false;
    if (filters.channel !== "ALL" && row.channel !== filters.channel) return false;
    if (filters.kind !== "ALL" && row.kind !== filters.kind) return false;
    if (filters.source !== "ALL" && row.source !== filters.source) return false;
    if (filters.eventId !== "ALL" && "eventId" in row && row.eventId !== filters.eventId) return false;
    if (filters.issuesOnly && row.status === "SENT") return false;
    if (!q) return true;
    const hay = [
      row.guestName,
      row.guestEmail ?? "",
      row.recipient ?? "",
      row.kindLabel,
      row.kind,
      row.errorDetail ?? "",
      row.errorCode ?? "",
      row.campaignLabel ?? "",
      ...(extraHay?.(row) ?? [])
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  out = [...out].sort((a, b) => {
    switch (filters.sort) {
      case "oldest":
        return a.at.getTime() - b.at.getTime();
      case "guest_asc":
        return a.guestName.localeCompare(b.guestName) || b.at.getTime() - a.at.getTime();
      case "guest_desc":
        return b.guestName.localeCompare(a.guestName) || b.at.getTime() - a.at.getTime();
      case "issues_first": {
        const sr = (STATUS_ISSUE_RANK[a.status] ?? 9) - (STATUS_ISSUE_RANK[b.status] ?? 9);
        if (sr !== 0) return sr;
        return b.at.getTime() - a.at.getTime();
      }
      case "newest":
      default:
        return b.at.getTime() - a.at.getTime();
    }
  });

  return out;
}

export function filterAndSortCleanupGuests<T extends GuestCleanupRow>(
  rows: T[],
  search: string,
  filters: CleanupFilterState,
  extraHay?: (row: T) => string[]
): T[] {
  const q = search.trim().toLowerCase();

  let out = rows.filter((g) => {
    if (filters.tag !== "ALL" && !g.tags.some((t) => t.id === filters.tag)) return false;
    if (filters.severity !== "ALL" && g.highestSeverity !== filters.severity) return false;
    if (filters.failures === "with_failures" && g.failedAttempts === 0) return false;
    if (filters.failures === "contact_only" && g.failedAttempts > 0) return false;
    if (!q) return true;
    const hay = [
      g.guestName,
      g.email ?? "",
      g.phone ?? "",
      g.company ?? "",
      ...g.tags.map((t) => t.label),
      ...(extraHay?.(g) ?? [])
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  out = [...out].sort((a, b) => {
    switch (filters.sort) {
      case "failures_desc":
        return b.failedAttempts - a.failedAttempts || compareSeverity(a, b);
      case "guest_asc":
        return a.guestName.localeCompare(b.guestName);
      case "guest_desc":
        return b.guestName.localeCompare(a.guestName);
      case "severity":
      default:
        return compareSeverity(a, b) || b.failedAttempts - a.failedAttempts;
    }
  });

  return out;
}

function compareSeverity(a: GuestCleanupRow, b: GuestCleanupRow): number {
  const ar = a.highestSeverity ? SEVERITY_RANK[a.highestSeverity] : 99;
  const br = b.highestSeverity ? SEVERITY_RANK[b.highestSeverity] : 99;
  return ar - br;
}

export function countActiveLogFilters(filters: DeliveryLogFilterState): number {
  let n = 0;
  if (filters.status !== "ALL") n += 1;
  if (filters.channel !== "ALL") n += 1;
  if (filters.kind !== "ALL") n += 1;
  if (filters.source !== "ALL") n += 1;
  if (filters.eventId !== "ALL") n += 1;
  if (filters.issuesOnly) n += 1;
  if (filters.sort !== "newest") n += 1;
  return n;
}

export function countActiveCleanupFilters(filters: CleanupFilterState): number {
  let n = 0;
  if (filters.tag !== "ALL") n += 1;
  if (filters.severity !== "ALL") n += 1;
  if (filters.failures !== "ALL") n += 1;
  if (filters.sort !== "severity") n += 1;
  return n;
}
