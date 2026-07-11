"use client";

import { AttendMode, Tier } from "@prisma/client";
import { BookmarkPlus, Loader2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BroadcastExtendedCrmFilters } from "@/components/broadcast/BroadcastExtendedCrmFilters";
import {
  GuestSegmentFilterControls,
  type GuestSegmentFilterOptions
} from "@/components/guests/GuestSegmentFilterControls";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getBroadcastSegmentFilterOptions,
  previewEmailBroadcastSegment,
  type BroadcastSegmentPreviewData
} from "@/lib/actions/emailBroadcast.actions";
import type { BroadcastEventOption, BroadcastSegmentFilterOptions } from "@/lib/db/emailBroadcast";
import type { EmailSegmentDefinition } from "@/lib/email/segmentDefinition";
import {
  deleteSavedEmailSegment,
  listSavedEmailSegments,
  saveEmailSegment,
  type SavedEmailSegment
} from "@/lib/email/savedSegmentsStorage";
import {
  EMPTY_SEGMENT_FILTER,
  segmentFilterIsActive,
  type GuestSegmentFilterInput
} from "@/lib/guests/segmentFilters";
import { cn, formatDate } from "@/lib/utils";

type EventScopeMode = "all" | "single" | "multi";

type BroadcastSegmentBuilderProps = {
  orgId: string;
  events: BroadcastEventOption[];
  initialFilterOptions: BroadcastSegmentFilterOptions;
  /** Called whenever the built segment definition changes (e.g. campaign create form). */
  onDefinitionChange?: (definition: EmailSegmentDefinition) => void;
};

const REGISTERED_DAY_PRESETS = [7, 14, 30, 90] as const;

function resolveScopedEventIds(
  scopeMode: EventScopeMode,
  singleEventId: string,
  multiEventIds: string[]
): string[] | null {
  if (scopeMode === "single" && singleEventId) return [singleEventId];
  if (scopeMode === "multi" && multiEventIds.length > 0) return multiEventIds;
  return null;
}

function buildSegmentDefinition(
  orgId: string,
  params: {
    scopeMode: EventScopeMode;
    singleEventId: string;
    multiEventIds: string[];
    excludeDeclinedNoShow: boolean;
    registeredWithinDays: number | null;
    attendeeExperience: "" | "first_time" | "returning";
    modes: AttendMode[];
    filter: GuestSegmentFilterInput;
  }
): EmailSegmentDefinition {
  const definition: EmailSegmentDefinition = {
    orgId,
    excludeDeclinedNoShow: params.excludeDeclinedNoShow
  };

  if (params.scopeMode === "single" && params.singleEventId) {
    definition.eventId = params.singleEventId;
  } else if (params.scopeMode === "multi" && params.multiEventIds.length > 0) {
    definition.eventIds = params.multiEventIds;
  }

  if (params.registeredWithinDays != null && params.registeredWithinDays > 0) {
    definition.registeredWithinDays = params.registeredWithinDays;
  }

  if (params.attendeeExperience) {
    definition.attendeeExperience = params.attendeeExperience;
  }

  if (params.modes.length > 0) {
    definition.modes = params.modes;
  }

  if (segmentFilterIsActive(params.filter)) {
    definition.filter = params.filter;
  }

  return definition;
}

function applySavedDefinition(
  definition: Omit<EmailSegmentDefinition, "orgId">,
  events: BroadcastEventOption[]
): {
  scopeMode: EventScopeMode;
  singleEventId: string;
  multiEventIds: string[];
  excludeDeclinedNoShow: boolean;
  registeredWithinDays: number | null;
  attendeeExperience: "" | "first_time" | "returning";
  modes: AttendMode[];
  filter: GuestSegmentFilterInput;
} {
  let scopeMode: EventScopeMode = "all";
  let singleEventId = events[0]?.id ?? "";
  let multiEventIds: string[] = [];

  if (definition.eventIds?.length) {
    scopeMode = definition.eventIds.length === 1 ? "single" : "multi";
    if (scopeMode === "single") {
      singleEventId = definition.eventIds[0]!;
    } else {
      multiEventIds = definition.eventIds;
    }
  } else if (definition.eventId) {
    scopeMode = "single";
    singleEventId = definition.eventId;
  }

  return {
    scopeMode,
    singleEventId,
    multiEventIds,
    excludeDeclinedNoShow: definition.excludeDeclinedNoShow !== false,
    registeredWithinDays: definition.registeredWithinDays ?? null,
    attendeeExperience: definition.attendeeExperience ?? "",
    modes: definition.modes ?? [],
    filter: definition.filter ?? EMPTY_SEGMENT_FILTER
  };
}

export function BroadcastSegmentBuilder({
  orgId,
  events,
  initialFilterOptions,
  onDefinitionChange
}: BroadcastSegmentBuilderProps) {
  const [scopeMode, setScopeMode] = useState<EventScopeMode>("all");
  const [singleEventId, setSingleEventId] = useState(events[0]?.id ?? "");
  const [multiEventIds, setMultiEventIds] = useState<string[]>([]);
  const [excludeDeclinedNoShow, setExcludeDeclinedNoShow] = useState(true);
  const [registeredWithinDays, setRegisteredWithinDays] = useState<number | null>(null);
  const [registeredDaysEnabled, setRegisteredDaysEnabled] = useState(false);
  const [attendeeExperience, setAttendeeExperience] = useState<"" | "first_time" | "returning">("");
  const [modes, setModes] = useState<AttendMode[]>([]);
  const [filter, setFilter] = useState<GuestSegmentFilterInput>(EMPTY_SEGMENT_FILTER);
  const [filterOptions, setFilterOptions] = useState(initialFilterOptions);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  const [preview, setPreview] = useState<BroadcastSegmentPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [savedSegments, setSavedSegments] = useState<SavedEmailSegment[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const scopedEventIds = useMemo(
    () => resolveScopedEventIds(scopeMode, singleEventId, multiEventIds),
    [scopeMode, singleEventId, multiEventIds]
  );

  const segmentDefinition = useMemo(
    () =>
      buildSegmentDefinition(orgId, {
        scopeMode,
        singleEventId,
        multiEventIds,
        excludeDeclinedNoShow,
        registeredWithinDays: registeredDaysEnabled ? registeredWithinDays : null,
        attendeeExperience,
        modes,
        filter
      }),
    [
      orgId,
      scopeMode,
      singleEventId,
      multiEventIds,
      excludeDeclinedNoShow,
      registeredDaysEnabled,
      registeredWithinDays,
      attendeeExperience,
      modes,
      filter
    ]
  );

  const segmentFilterUiOptions: GuestSegmentFilterOptions = useMemo(
    () => ({
      tiers: filterOptions.tiers,
      groups: filterOptions.groups.map((g) => ({
        id: g.id,
        name:
          scopeMode === "all" || scopeMode === "multi"
            ? `${g.name} · ${g.eventName}`
            : g.name
      })),
      contactCategories: filterOptions.contactCategories
    }),
    [filterOptions, scopeMode]
  );

  const refreshSavedSegments = useCallback(() => {
    setSavedSegments(listSavedEmailSegments(orgId));
  }, [orgId]);

  useEffect(() => {
    refreshSavedSegments();
  }, [refreshSavedSegments]);

  useEffect(() => {
    let cancelled = false;
    setFilterOptionsLoading(true);
    void getBroadcastSegmentFilterOptions({ eventIds: scopedEventIds }).then((res) => {
      if (cancelled) return;
      setFilterOptionsLoading(false);
      if (res.success && res.data) {
        setFilterOptions(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scopedEventIds]);

  useEffect(() => {
    onDefinitionChange?.(segmentDefinition);
  }, [segmentDefinition, onDefinitionChange]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        const res = await previewEmailBroadcastSegment({
          definition: segmentDefinition,
          previewLimit: 25
        });
        setPreviewLoading(false);
        if (!res.success || !res.data) {
          setPreview(null);
          setPreviewError(res.error ?? "Could not preview segment.");
          return;
        }
        setPreview(res.data);
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [segmentDefinition]);

  function toggleMode(mode: AttendMode) {
    setModes((current) =>
      current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode]
    );
  }

  function toggleMultiEvent(eventId: string) {
    setMultiEventIds((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]
    );
  }

  function loadSavedSegment(segment: SavedEmailSegment) {
    const next = applySavedDefinition(segment.definition, events);
    setScopeMode(next.scopeMode);
    setSingleEventId(next.singleEventId);
    setMultiEventIds(next.multiEventIds);
    setExcludeDeclinedNoShow(next.excludeDeclinedNoShow);
    setRegisteredWithinDays(next.registeredWithinDays);
    setRegisteredDaysEnabled(next.registeredWithinDays != null);
    setAttendeeExperience(next.attendeeExperience);
    setModes(next.modes);
    setFilter(next.filter);
    setSaveName(segment.name);
  }

  function handleSaveSegment() {
    const name = saveName.trim();
    if (!name) {
      setSaveFeedback("Enter a name for this segment.");
      return;
    }
    const { orgId: _org, ...rest } = segmentDefinition;
    saveEmailSegment(orgId, name, rest);
    refreshSavedSegments();
    setSaveFeedback("Segment saved.");
    window.setTimeout(() => setSaveFeedback(null), 2500);
  }

  const exclusionSummary = preview
    ? [
        preview.excluded.unsubscribed > 0
          ? `${preview.excluded.unsubscribed} unsubscribed`
          : null,
        preview.excluded.noEmailContact > 0
          ? `${preview.excluded.noEmailContact} no contact row`
          : null,
        preview.excluded.noEmailAddress > 0
          ? `${preview.excluded.noEmailAddress} no email`
          : null
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
      <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Event scope</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["all", "All events"],
                ["single", "One event"],
                ["multi", "Multiple events"]
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  scopeMode === mode
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
                onClick={() => setScopeMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {scopeMode === "single" ? (
            <select
              className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={singleEventId}
              onChange={(e) => setSingleEventId(e.target.value)}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {formatDate(event.date)}
                </option>
              ))}
            </select>
          ) : null}

          {scopeMode === "multi" ? (
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-100 p-2">
              {events.map((event) => (
                <label key={event.id} className="flex items-start gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-zinc-300"
                    checked={multiEventIds.includes(event.id)}
                    onChange={() => toggleMultiEvent(event.id)}
                  />
                  <span>
                    <span className="block font-medium">{event.name}</span>
                    <span className="text-xs text-zinc-500">{formatDate(event.date)}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-zinc-300"
              checked={excludeDeclinedNoShow}
              onChange={(e) => setExcludeDeclinedNoShow(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                Exclude declined &amp; no-show
              </span>
              <span className="text-xs text-zinc-500">
                On by default. Turn off for win-back or reminder campaigns.
              </span>
            </span>
          </label>
        </div>

        <div className="border-t border-zinc-100 pt-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-900">
            <input
              type="checkbox"
              className="rounded border-zinc-300"
              checked={registeredDaysEnabled}
              onChange={(e) => {
                setRegisteredDaysEnabled(e.target.checked);
                if (e.target.checked && registeredWithinDays == null) {
                  setRegisteredWithinDays(30);
                }
              }}
            />
            Registered in the last N days
          </label>
          {registeredDaysEnabled ? (
            <div className="flex flex-wrap items-center gap-2">
              {REGISTERED_DAY_PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    registeredWithinDays === days
                      ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  )}
                  onClick={() => setRegisteredWithinDays(days)}
                >
                  {days}d
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={366}
                value={registeredWithinDays ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setRegisteredWithinDays(Number.isFinite(n) && n > 0 ? n : null);
                }}
                className="h-8 w-20 text-sm"
                aria-label="Custom days"
              />
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Attendee experience
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["", "Any"],
                ["first_time", "First-time"],
                ["returning", "Returning"]
              ] as const
            ).map(([value, label]) => (
              <button
                key={value || "any"}
                type="button"
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  attendeeExperience === value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
                onClick={() => setAttendeeExperience(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Attendance mode
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {([AttendMode.IN_PERSON, AttendMode.VIRTUAL] as const).map((mode) => (
              <label key={mode} className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={modes.includes(mode)}
                  onChange={() => toggleMode(mode)}
                />
                {mode === AttendMode.IN_PERSON ? "In person" : "Virtual"}
              </label>
            ))}
          </div>
        </div>

        <div className="relative border-t border-zinc-100 pt-4">
          {filterOptionsLoading ? (
            <div className="absolute right-0 top-4 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            </div>
          ) : null}
          <GuestSegmentFilterControls
            value={filter}
            onChange={setFilter}
            options={segmentFilterUiOptions}
            compact
          />
          <BroadcastExtendedCrmFilters
            value={filter}
            onChange={setFilter}
            companies={filterOptions.companies}
            emailDomains={filterOptions.emailDomains}
            className="mt-4 border-t border-zinc-100 pt-4"
          />
        </div>

        <div className="border-t border-zinc-100 pt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Saved segments
          </p>
          {savedSegments.length === 0 ? (
            <p className="text-xs text-zinc-500">No saved segments yet.</p>
          ) : (
            <ul className="max-h-28 space-y-1 overflow-y-auto">
              {savedSegments.map((segment) => (
                <li key={segment.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm text-indigo-700 hover:underline"
                    onClick={() => loadSavedSegment(segment)}
                  >
                    {segment.name}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-zinc-400 hover:text-red-600"
                    onClick={() => {
                      deleteSavedEmailSegment(orgId, segment.id);
                      refreshSavedSegments();
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Segment name"
              className="h-9 text-sm"
            />
            <Button type="button" variant="secondary" onClick={handleSaveSegment}>
              <BookmarkPlus className="h-4 w-4" aria-hidden />
              Save
            </Button>
          </div>
          {saveFeedback ? <p className="text-xs text-zinc-600">{saveFeedback}</p> : null}
        </div>
      </aside>

      <section className="flex min-h-[28rem] flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Recipient preview</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Subscribed marketing contacts only · updates as you adjust filters
              </p>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-3xl font-semibold tabular-nums text-zinc-900">
              {preview?.recipientCount ?? "—"}
              <span className="ml-1.5 text-base font-normal text-zinc-500">recipients</span>
            </p>
            {preview && preview.matchedGuestCount > preview.recipientCount ? (
              <p className="text-sm text-zinc-600">
                {preview.matchedGuestCount} matched ·{" "}
                <span className="text-amber-800">
                  {preview.excluded.totalExcluded} excluded
                  {exclusionSummary ? ` (${exclusionSummary})` : ""}
                </span>
              </p>
            ) : preview ? (
              <p className="text-sm text-zinc-500">{preview.matchedGuestCount} guests matched</p>
            ) : null}
          </div>

          {previewError ? <p className="mt-2 text-sm text-red-600">{previewError}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Event</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {!preview || preview.recipients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-zinc-500">
                    {previewLoading
                      ? "Loading preview…"
                      : preview && preview.recipientCount === 0
                        ? "No subscribed recipients match these filters."
                        : "Adjust filters to preview recipients."}
                  </td>
                </tr>
              ) : (
                preview.recipients.map((row) => (
                  <tr key={row.guestId} className="border-t border-zinc-100">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{row.guestName}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{row.emailContactEmail}</td>
                    <td className="hidden px-4 py-2.5 text-zinc-600 sm:table-cell">{row.eventName}</td>
                    <td className="hidden px-4 py-2.5 text-zinc-500 md:table-cell">{row.guestStatus}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {preview?.previewLimitApplied ? (
          <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
            Showing first {preview.previewLimitApplied} of {preview.recipientCount} recipients.
          </p>
        ) : null}
      </section>
    </div>
  );
}
