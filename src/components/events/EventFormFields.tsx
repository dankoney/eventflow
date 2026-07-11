"use client";

import {
  AttendeeTheme,
  PublicPageTemplate,
  EventScheduleMode,
  EventStatus,
  EventType,
  ZoomSessionKind
} from "@prisma/client";
import { useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Controller, useFieldArray, type UseFormReturn } from "react-hook-form";

import { BrandPrimaryColorField } from "@/components/events/BrandPrimaryColorField";
import { EventBannerField } from "@/components/events/EventBannerField";
import { EventLogoField } from "@/components/events/EventLogoField";
import { EventManualReminderSend } from "@/components/events/EventManualReminderSend";
import { LocationVenuePicker } from "@/components/locations/LocationVenuePicker";
import type { EventFormValues, EventLocationOption } from "@/components/events/eventFormSchema";
import { defaultEndFromStart, defaultStartDate } from "@/components/events/eventFormSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { isSameLocalCalendarDay } from "@/lib/event-schedule/multiDayConfig";

export type EventFormFieldsSection =
  | "nameDescription"
  | "identity"
  | "schedule"
  | "venueAttendance"
  | "reminders";

function showSection(active: EventFormFieldsSection[] | undefined, s: EventFormFieldsSection) {
  if (active === undefined) return true;
  if (active.includes(s)) return true;
  return false;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function clampSessionEndSameDay(start: Date, end: Date): Date {
  const cap = endOfLocalDay(start).getTime();
  const t = Math.min(end.getTime(), cap);
  const minEnd = start.getTime() + 15 * 60 * 1000;
  return new Date(Math.max(t, minEnd));
}

function defaultMultiDayPlaceholderRows(s: Date, e: Date): { startsAt: Date; endsAt: Date; zoomJoinUrl: string }[] {
  const row1End = clampSessionEndSameDay(s, defaultEndFromStart(s));
  let row2Start: Date;
  let row2End: Date;
  if (isSameLocalCalendarDay(s, e)) {
    row2Start = new Date(row1End.getTime() + 30 * 60 * 1000);
    if (row2Start.getTime() >= e.getTime()) {
      row2Start = new Date(e.getTime() - 60 * 60 * 1000);
    }
    row2End = clampSessionEndSameDay(row2Start, e);
  } else {
    row2Start = startOfLocalDay(e);
    if (row2Start.getTime() <= row1End.getTime()) {
      row2Start = new Date(row1End.getTime() + 60 * 60 * 1000);
    }
    if (!isSameLocalCalendarDay(row2Start, e)) {
      row2Start = startOfLocalDay(e);
    }
    row2End = clampSessionEndSameDay(row2Start, e);
    if (row2End.getTime() > e.getTime()) {
      row2End = new Date(e.getTime());
    }
    if (row2Start.getTime() >= row2End.getTime()) {
      row2Start = new Date(row2End.getTime() - 60 * 60 * 1000);
    }
  }
  return [
    { startsAt: s, endsAt: row1End, zoomJoinUrl: "" },
    { startsAt: row2Start, endsAt: row2End, zoomJoinUrl: "" }
  ];
}

/** Muted panel behind fields (inputs stay white for contrast). */
const sectionCardClass = "rounded-xl border border-slate-200/100 bg-slate-50/95 p-4 shadow-sm ring-1 ring-slate-200/20";
const sectionCardSubtleClass =
  "rounded-xl border border-slate-200/90 bg-slate-100/70 p-4 shadow-sm ring-1 ring-slate-300/10";

const datePickerInputClass =
  "h-10 w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25";
const selectClass =
  "h-10 w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25";
const textAreaClass =
  "w-full rounded-md border border-slate-400/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-400/25";

const EVENT_TYPE_VISUAL: Record<EventType, { idle: string; active: string }> = {
  [EventType.IN_PERSON]: {
    idle: "border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 to-white text-emerald-950",
    active: "border-emerald-600 bg-emerald-100/90 text-emerald-950 ring-2 ring-emerald-500/30"
  },
  [EventType.HYBRID]: {
    idle: "border-violet-200/90 bg-gradient-to-br from-violet-50/90 to-white text-violet-950",
    active: "border-violet-600 bg-violet-100/90 text-violet-950 ring-2 ring-violet-500/30"
  },
  [EventType.VIRTUAL]: {
    idle: "border-sky-200/90 bg-gradient-to-br from-sky-50/90 to-white text-sky-950",
    active: "border-sky-600 bg-sky-100/90 text-sky-950 ring-2 ring-sky-500/30"
  }
};

export type EventFormFieldsProps = {
  form: UseFormReturn<EventFormValues>;
  locations: EventLocationOption[];
  locked?: boolean;
  mode?: "create" | "edit";
  eventId?: string;
  eventStatus?: EventStatus;
  zoomSessionKindLocked?: boolean;
  defaultValues?: Partial<EventFormValues>;
  /** When set, only these blocks render (blueprint wizard). Omit for full create/edit form. */
  activeSections?: EventFormFieldsSection[];
  /** When virtual/hybrid turns on auto virtual capacity, use this value (org default, usually 100). */
  virtualCapacityOnEnable?: number;
  /** Enables Google Places + static map preview in the venue picker (org or server env key). */
  hasGoogleMaps?: boolean;
};

export function EventFormFields({
  form,
  locations,
  locked = false,
  mode = "create",
  eventId,
  eventStatus,
  zoomSessionKindLocked = false,
  defaultValues,
  activeSections,
  virtualCapacityOnEnable = 100,
  hasGoogleMaps = false
}: EventFormFieldsProps) {
  const isWizard = activeSections !== undefined;
  const { fields: multiDayFields, append: appendMultiDay, remove: removeMultiDay } = useFieldArray({
    control: form.control,
    name: "multiDayDays"
  });

  const enableVirtual = form.watch("enableVirtual");
  const type = form.watch("type");
  const historicalMode = form.watch("historicalMode");
  const startDate = form.watch("date");
  const scheduleMode = form.watch("scheduleMode");
  const multiDayVirtualLinkMode = form.watch("multiDayVirtualLinkMode");
  const watchedLocationId = form.watch("locationId");
  const prevLocForCapacityRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const loc = locations.find((l) => l.id === watchedLocationId);
    if (!loc) return;

    if (mode === "edit") {
      if (prevLocForCapacityRef.current === undefined) {
        prevLocForCapacityRef.current = watchedLocationId;
        return;
      }
      if (prevLocForCapacityRef.current === watchedLocationId) return;
    }
    prevLocForCapacityRef.current = watchedLocationId;
    form.setValue("capacity", loc.capacity, { shouldValidate: true });
  }, [watchedLocationId, locations, form, mode]);

  useEffect(() => {
    const start = form.getValues("date");
    const end = form.getValues("endDate");
    if (end.getTime() <= start.getTime()) {
      form.setValue("endDate", defaultEndFromStart(start), { shouldValidate: true });
    }
  }, [form, startDate]);

  useEffect(() => {
    if (type === EventType.VIRTUAL || type === EventType.HYBRID) {
      if (!form.getValues("enableVirtual")) {
        form.setValue("enableVirtual", true, { shouldValidate: true });
      }
      if ((form.getValues("virtualCapacity") ?? 0) < 1) {
        form.setValue("virtualCapacity", virtualCapacityOnEnable, { shouldValidate: true });
      }
      return;
    }
    if (type === EventType.IN_PERSON && form.getValues("enableVirtual")) {
      form.setValue("type", EventType.HYBRID, { shouldValidate: true });
      if ((form.getValues("virtualCapacity") ?? 0) < 1) {
        form.setValue("virtualCapacity", virtualCapacityOnEnable, { shouldValidate: true });
      }
    }
  }, [form, type, enableVirtual, virtualCapacityOnEnable]);

  const lastScheduleModeRef = useRef<EventScheduleMode | undefined>(undefined);

  useEffect(() => {
    const from = lastScheduleModeRef.current;
    lastScheduleModeRef.current = scheduleMode;

    if (scheduleMode !== EventScheduleMode.MULTI_DAY) return;
    if (from === undefined) return;
    const switchedToMulti =
      scheduleMode === EventScheduleMode.MULTI_DAY && from !== EventScheduleMode.MULTI_DAY;
    if (!switchedToMulti) return;

    const prev = form.getValues("multiDayDays") ?? [];
    if (prev.length > 0) return;

    const s = form.getValues("date");
    const e = form.getValues("endDate");
    if (e.getTime() <= s.getTime()) return;
    form.setValue("multiDayDays", defaultMultiDayPlaceholderRows(s, e), { shouldValidate: true });
  }, [scheduleMode, form]);

  useEffect(() => {
    if (historicalMode) return;
    const now = Date.now();
    let start = form.getValues("date");
    if (start.getTime() < now) {
      start = defaultStartDate();
      form.setValue("date", start, { shouldValidate: true });
    }
    let end = form.getValues("endDate");
    if (end.getTime() <= start.getTime()) {
      end = defaultEndFromStart(start);
      form.setValue("endDate", end, { shouldValidate: true });
    } else if (end.getTime() < now) {
      const candidate = defaultEndFromStart(start);
      const nextEnd =
        candidate.getTime() >= now ? candidate : new Date(Math.max(now, start.getTime()) + 60 * 60 * 1000);
      form.setValue("endDate", nextEnd, { shouldValidate: true });
    }
  }, [form, historicalMode]);

  const s = (sec: EventFormFieldsSection) => showSection(activeSections, sec);

  return (
    <div className="space-y-5">
      {s("nameDescription") ? (
        <div className={cn("space-y-4", sectionCardClass)}>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
              Event name
            </label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
              Event description {isWizard ? <span className="font-normal text-slate-400">(optional)</span> : null}
            </label>
            <textarea
              id="description"
              rows={3}
              className={textAreaClass}
              placeholder={isWizard ? "Add details now or later from the event page." : undefined}
              {...form.register("description")}
            />
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Event type</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { v: EventType.IN_PERSON, label: "In person" },
                  { v: EventType.HYBRID, label: "Hybrid" },
                  { v: EventType.VIRTUAL, label: "Virtual" }
                ] as const
              ).map(({ v, label }) => {
                const vis = EVENT_TYPE_VISUAL[v];
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      form.setValue("type", v, { shouldValidate: true, shouldDirty: true });
                      if (v === EventType.IN_PERSON) {
                        form.setValue("enableVirtual", false, { shouldValidate: true });
                        form.setValue("virtualCapacity", 0, { shouldValidate: true });
                      }
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm transition-colors",
                      type === v ? vis.active : cn(vis.idle, "hover:brightness-[0.99]")
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.type ? (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.type.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {s("identity") ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Registration page appearance.</p>
          <div className={sectionCardClass}>
            <p className="text-sm font-semibold text-slate-900">Banner</p>
            <div className="mt-2">
              <EventBannerField form={form} compact={isWizard} />
            </div>
          </div>
          <div className={sectionCardClass}>
            <p className="text-sm font-semibold text-slate-900">Logo</p>
            <div className="mt-2">
              <EventLogoField form={form} compact={isWizard} />
            </div>
          </div>
          <div className={sectionCardClass}>
            <label htmlFor="publicPageTemplate" className="mb-2 block text-sm font-semibold text-slate-900">
              Page template
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Template 1 supports light/dark. Templates 2 and 3 use dedicated dark MD3 layouts.
            </p>
            <select id="publicPageTemplate" className={selectClass} {...form.register("publicPageTemplate")}>
              <option value={PublicPageTemplate.SUMMIT}>Template 1 — Summit</option>
              <option value={PublicPageTemplate.NIGHT_EDITION}>Template 2 — Night Edition</option>
              <option value={PublicPageTemplate.TECH_NEXUS}>Template 3 — TechNexus</option>
            </select>
          </div>
          <div className={sectionCardClass}>
            <label htmlFor="attendeeTheme" className="mb-2 block text-sm font-semibold text-slate-900">
              Color mode (Template 1)
            </label>
            <p className="mb-2 text-xs text-slate-500">Light or dark for Summit; also styles the registration form on Template 2.</p>
            <select id="attendeeTheme" className={selectClass} {...form.register("attendeeTheme")}>
              <option value={AttendeeTheme.LIGHT}>Light</option>
              <option value={AttendeeTheme.DARK}>Dark</option>
              <option value={AttendeeTheme.SYSTEM}>System (follow device)</option>
            </select>
          </div>
          <div className={sectionCardClass}>
            <p className="mb-2 text-sm font-semibold text-slate-900">Brand color</p>
            <p className="mb-3 text-xs text-slate-500">Accents buttons and highlights on the public page.</p>
            <BrandPrimaryColorField form={form} />
            {form.formState.errors.brandPrimaryColor ? (
              <p className="mt-2 text-sm text-red-600">{form.formState.errors.brandPrimaryColor.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {s("schedule") ? (
        <>
          <div className={cn(sectionCardClass, "grid gap-4 sm:grid-cols-2")}>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Start</span>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    selected={field.value}
                    onChange={(d) => field.onChange(d ?? field.value)}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="MMM d, yyyy h:mm aa"
                    minDate={historicalMode ? undefined : new Date()}
                    className={datePickerInputClass}
                    wrapperClassName="w-full"
                  />
                )}
              />
              {form.formState.errors.date && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.date.message}</p>
              )}
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">End</span>
              <Controller
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <DatePicker
                    selected={field.value}
                    onChange={(d) => field.onChange(d ?? defaultEndFromStart(form.getValues("date")))}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="MMM d, yyyy h:mm aa"
                    minDate={historicalMode ? startDate : new Date(Math.max(new Date().getTime(), startDate.getTime()))}
                    className={datePickerInputClass}
                    wrapperClassName="w-full"
                  />
                )}
              />
              {form.formState.errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.endDate.message}</p>
              )}
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
              <input type="checkbox" className="rounded border-slate-300" {...form.register("historicalMode")} />
              Historical mode (allow past start date)
            </label>
          </div>

          <div className={sectionCardClass}>
            <h3 className="text-sm font-semibold text-slate-900">Schedule shape</h3>
            <p className="mt-1 text-xs text-slate-500">
              Use program start/end above as the full window. Multi-day: one row per day (max 14); each day stays on one
              calendar day.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
                  scheduleMode === EventScheduleMode.SINGLE_BLOCK
                    ? "border-slate-900 bg-white shadow-sm ring-2 ring-slate-900/10"
                    : "border-slate-300/80 bg-white/90 shadow-sm"
                )}
              >
                <input
                  type="radio"
                  className="border-slate-300"
                  value={EventScheduleMode.SINGLE_BLOCK}
                  {...form.register("scheduleMode")}
                />
                Single block
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
                  scheduleMode === EventScheduleMode.MULTI_DAY
                    ? "border-slate-900 bg-white shadow-sm ring-2 ring-slate-900/10"
                    : "border-slate-300/80 bg-white/90 shadow-sm"
                )}
              >
                <input
                  type="radio"
                  className="border-slate-300"
                  value={EventScheduleMode.MULTI_DAY}
                  {...form.register("scheduleMode")}
                />
                Multi-day
              </label>
            </div>

            {scheduleMode === EventScheduleMode.MULTI_DAY ? (
              <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                <input type="hidden" {...form.register("multiDayVirtualLinkMode")} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1 block text-xs font-medium text-slate-700">Registration</span>
                    <select className={selectClass} {...form.register("multiDayRegistrationPolicy")}>
                      <option value="OPEN_UNTIL_EVENT_END">Open until event ends</option>
                      <option value="FIRST_DAY_ONLY">First day only</option>
                    </select>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-slate-700">Check-in</span>
                    <select className={selectClass} {...form.register("multiDayCheckInPolicy")}>
                      <option value="ONCE_FOR_EVENT">Once for whole program</option>
                      <option value="EACH_DAY">Each day</option>
                    </select>
                  </div>
                </div>

                {(enableVirtual || type === EventType.VIRTUAL || type === EventType.HYBRID) && (
                  <div className="rounded-lg border border-slate-200/80 bg-slate-100/80 p-3 shadow-sm ring-1 ring-slate-300/20">
                    <span className="text-xs font-semibold text-slate-800">Zoom</span>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          form.setValue("multiDayVirtualLinkMode", "SHARED", { shouldValidate: true, shouldDirty: true })
                        }
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm font-medium transition",
                          multiDayVirtualLinkMode === "SHARED"
                            ? "border-slate-900 bg-white shadow-sm"
                            : "border-slate-300/80 bg-white text-slate-600 shadow-sm hover:border-slate-400"
                        )}
                      >
                        One link (whole program)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          form.setValue("multiDayVirtualLinkMode", "PER_DAY", { shouldValidate: true, shouldDirty: true })
                        }
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm font-medium transition",
                          multiDayVirtualLinkMode === "PER_DAY"
                            ? "border-slate-900 bg-white shadow-sm"
                            : "border-slate-300/80 bg-white text-slate-600 shadow-sm hover:border-slate-400"
                        )}
                      >
                        Per day
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Per day needs Meeting mode.</p>
                  </div>
                )}

                <details className="group rounded-lg border border-slate-200/80 bg-slate-100/50 ring-1 ring-slate-200/30">
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-slate-800 marker:hidden [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">More options</span>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-2">
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-300" {...form.register("multiDayShowAgendaPublic")} />
                      <span>Show day-by-day agenda publicly</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300"
                        {...form.register("multiDayAllowStaffCheckInOutsideSession")}
                      />
                      <span>Allow staff check-in between sessions (with daily check-in)</span>
                    </label>
                  </div>
                </details>

                <div className="space-y-3">
                  {multiDayFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-xl border border-slate-300/60 bg-white p-3 shadow-sm ring-1 ring-slate-200/20"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Day {index + 1}</span>
                        {multiDayFields.length > 2 ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-red-700 hover:underline"
                            onClick={() => removeMultiDay(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <span className="mb-1 block text-xs text-slate-600">Session start</span>
                          <Controller
                            control={form.control}
                            name={`multiDayDays.${index}.startsAt`}
                            render={({ field: f }) => (
                              <DatePicker
                                selected={f.value}
                                onChange={(d) => f.onChange(d ?? f.value)}
                                showTimeSelect
                                timeIntervals={15}
                                dateFormat="MMM d, yyyy h:mm aa"
                                className={datePickerInputClass}
                                wrapperClassName="w-full"
                              />
                            )}
                          />
                          {form.formState.errors.multiDayDays?.[index]?.startsAt ? (
                            <p className="mt-1 text-sm text-red-600">
                              {form.formState.errors.multiDayDays[index]?.startsAt?.message}
                            </p>
                          ) : null}
                        </div>
                        <div>
                          <span className="mb-1 block text-xs text-slate-600">Daily close / end</span>
                          <Controller
                            control={form.control}
                            name={`multiDayDays.${index}.endsAt`}
                            render={({ field: f }) => (
                              <DatePicker
                                selected={f.value}
                                onChange={(d) => f.onChange(d ?? f.value)}
                                showTimeSelect
                                timeIntervals={15}
                                dateFormat="MMM d, yyyy h:mm aa"
                                className={datePickerInputClass}
                                wrapperClassName="w-full"
                              />
                            )}
                          />
                          {form.formState.errors.multiDayDays?.[index]?.endsAt ? (
                            <p className="mt-1 text-sm text-red-600">
                              {form.formState.errors.multiDayDays[index]?.endsAt?.message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {(enableVirtual || type === EventType.VIRTUAL || type === EventType.HYBRID) &&
                      multiDayVirtualLinkMode === "PER_DAY" ? (
                        <div className="mt-3">
                          <label className="mb-1 block text-xs text-slate-600">Zoom join URL (this day)</label>
                          <Input type="url" placeholder="https://zoom.us/j/..." {...form.register(`multiDayDays.${index}.zoomJoinUrl`)} />
                          {form.formState.errors.multiDayDays?.[index]?.zoomJoinUrl ? (
                            <p className="mt-1 text-sm text-red-600">
                              {form.formState.errors.multiDayDays[index]?.zoomJoinUrl?.message}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-sm"
                  onClick={() => {
                    const lastEnd = form.getValues(`multiDayDays.${multiDayFields.length - 1}.endsAt`);
                    const nextStart = new Date(lastEnd.getTime() + 60 * 60 * 1000);
                    appendMultiDay({
                      startsAt: nextStart,
                      endsAt: new Date(nextStart.getTime() + 8 * 60 * 60 * 1000),
                      zoomJoinUrl: ""
                    });
                  }}
                >
                  Add day
                </Button>
                {form.formState.errors.multiDayDays && !Array.isArray(form.formState.errors.multiDayDays) ? (
                  <p className="text-sm text-red-600">{form.formState.errors.multiDayDays.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {s("venueAttendance") ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Where people attend and how many you can host.</p>

          <div className={sectionCardClass}>
            <h3 className="text-sm font-semibold text-slate-900">Location</h3>
            {locked ? (
              <p className="mt-2 rounded-lg border border-slate-300/60 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm">
                {locations.find((l) => l.id === watchedLocationId)?.name ?? "—"}
                <span className="mt-1 block text-xs text-slate-600">
                  {locations.find((l) => l.id === watchedLocationId)?.address ?? ""}
                </span>
              </p>
            ) : (
              <div className="mt-2">
                <LocationVenuePicker form={form} locations={locations} hasGoogleMaps={hasGoogleMaps} />
              </div>
            )}
          </div>

          <div className={sectionCardClass}>
            <h3 className="text-sm font-semibold text-slate-900">In-person capacity</h3>
            <p className="mt-1 text-xs text-slate-500">Seats for on-site guests at this location.</p>
            <Input id="capacity" type="number" min={1} {...form.register("capacity")} className="mt-2 max-w-xs" />
            {form.formState.errors.capacity ? (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.capacity.message}</p>
            ) : null}
          </div>

          <div className={sectionCardSubtleClass}>
            <h3 className="text-sm font-semibold text-slate-900">Virtual (Zoom)</h3>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                {...form.register("enableVirtual")}
                disabled={type === EventType.VIRTUAL || type === EventType.HYBRID}
              />
              Enable online attendance
            </label>
            {type === EventType.VIRTUAL || type === EventType.HYBRID ? (
              <p className="mt-2 text-xs text-slate-600">
                {type === EventType.VIRTUAL ? "Virtual" : "Hybrid"} programs include a Zoom session.
              </p>
            ) : null}
            {enableVirtual ? (
              <div className="mt-4 space-y-4 border-t border-slate-200/80 pt-4">
                <div>
                  <label htmlFor="virtualCapacity" className="mb-1 block text-sm text-slate-700">
                    Online seats
                  </label>
                  <Input
                    id="virtualCapacity"
                    className="max-w-xs"
                    type="number"
                    min={1}
                    {...form.register("virtualCapacity", { valueAsNumber: true })}
                  />
                  {form.formState.errors.virtualCapacity && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.virtualCapacity.message}</p>
                  )}
                </div>
                <div>
                  <span className="mb-2 block text-sm text-slate-700">Session type</span>
                  {zoomSessionKindLocked ? (
                    <>
                      <p className="text-sm text-slate-600">
                        Locked:{" "}
                        <strong>
                          {form.getValues("zoomSessionKind") === ZoomSessionKind.MEETING ? "Meeting" : "Webinar"}
                        </strong>
                        .
                      </p>
                      <input type="hidden" {...form.register("zoomSessionKind")} />
                    </>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                          form.watch("zoomSessionKind") === ZoomSessionKind.WEBINAR
                            ? "border-slate-800 bg-white shadow-md ring-1 ring-slate-300/30"
                            : "border-slate-300/80 bg-white shadow-sm"
                        )}
                      >
                        <input
                          type="radio"
                          className="border-slate-300"
                          value={ZoomSessionKind.WEBINAR}
                          {...form.register("zoomSessionKind")}
                        />
                        Webinar
                      </label>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                          form.watch("zoomSessionKind") === ZoomSessionKind.MEETING
                            ? "border-slate-800 bg-white shadow-md ring-1 ring-slate-300/30"
                            : "border-slate-300/80 bg-white shadow-sm"
                        )}
                      >
                        <input
                          type="radio"
                          className="border-slate-300"
                          value={ZoomSessionKind.MEETING}
                          {...form.register("zoomSessionKind")}
                        />
                        Meeting
                      </label>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-500">Scopes are configured under Settings → Integrations.</p>
                </div>
                {!zoomSessionKindLocked ? (
                  <div>
                    <span className="mb-2 block text-sm text-slate-700">Room passcode</span>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          value="default"
                          {...form.register("zoomPasscodeMode")}
                        />
                        Zoom default (auto-generated)
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          value="custom"
                          {...form.register("zoomPasscodeMode")}
                        />
                        Custom passcode
                      </label>
                    </div>
                    {form.watch("zoomPasscodeMode") === "custom" ? (
                      <div className="mt-2 max-w-md">
                        <Input
                          className="font-mono"
                          placeholder="e.g. Summit2026"
                          maxLength={10}
                          {...form.register("zoomCustomPasscode")}
                        />
                        {form.formState.errors.zoomCustomPasscode ? (
                          <p className="mt-1 text-sm text-red-600">
                            {form.formState.errors.zoomCustomPasscode.message}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      Custom passcodes cannot include spaces — only visible letters, numbers, and symbols (max 10).
                      Use the refresh icon beside the passcode on the event page to change it after creation.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {s("reminders") ? (
        <div className={sectionCardClass}>
          <h3 className="text-sm font-semibold text-slate-900">Reminders</h3>
          <p className="mt-1 text-xs text-slate-600">
            Automated sends use your org Resend, WhatsApp, and mNotify (SMS) settings. Schedule a cron job hitting{" "}
            <code className="rounded bg-slate-100 px-1">GET /api/cron/reminders</code> with{" "}
            <code className="rounded bg-slate-100 px-1">Authorization: Bearer CRON_SECRET</code>.
          </p>
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" className="rounded border-slate-300" {...form.register("reminderPrimaryEnabled")} />
              Primary reminder (before event)
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-700">Hours before start</span>
                <select className={selectClass} {...form.register("reminderPrimaryHoursBefore", { valueAsNumber: true })}>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 text-sm text-slate-800">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-slate-300" {...form.register("reminderPrimaryEmail")} />
                  Email
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    {...form.register("reminderPrimaryWhatsapp")}
                  />
                  WhatsApp (guests with phone on file)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-slate-300" {...form.register("reminderPrimarySms")} />
                  SMS via mNotify (guests with phone; org integration enabled)
                </label>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" className="rounded border-slate-300" {...form.register("reminderFinalEnabled")} />
              Final reminder (close to start)
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-700">Hours before start</span>
                <select className={selectClass} {...form.register("reminderFinalHoursBefore", { valueAsNumber: true })}>
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={5}>5 hours</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" className="rounded border-slate-300" {...form.register("reminderFinalWhatsapp")} />
                WhatsApp with Zoom / QR hints (plus email)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" className="rounded border-slate-300" {...form.register("reminderFinalSms")} />
                SMS via mNotify (per guest; join link when virtual)
              </label>
            </div>
          </div>
          {mode === "edit" &&
          eventId &&
          !locked &&
          eventStatus &&
          (eventStatus === EventStatus.PUBLISHED || eventStatus === EventStatus.LIVE) ? (
            <EventManualReminderSend
              eventId={eventId}
              primaryReminderEnabled={defaultValues?.reminderPrimaryEnabled ?? false}
              finalReminderEnabled={defaultValues?.reminderFinalEnabled ?? false}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
