"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EventStatus, EventType, ZoomSessionKind } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { EventManualReminderSend } from "@/components/events/EventManualReminderSend";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { createEvent, updateEvent } from "@/lib/actions/event.actions";

export type EventLocationOption = {
  id: string;
  name: string;
  address: string;
  capacity: number;
};

function defaultStartDate(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(0, 0, 0);
  return d;
}

function defaultEndFromStart(start: Date): Date {
  return new Date(start.getTime() + 2 * 60 * 60 * 1000);
}

const datePickerInputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 transition focus:ring-2";
const selectClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 transition focus:ring-2";

const schema = z
  .object({
    name: z.string().min(2, "Name is required"),
    description: z.string().optional(),
    date: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
    locationId: z.string().min(1, "Choose a venue"),
    capacity: z.coerce.number().int().min(1),
    enableVirtual: z.boolean(),
    virtualCapacity: z.coerce.number().int().min(0),
    type: z.nativeEnum(EventType),
    historicalMode: z.boolean(),
    reminderPrimaryEnabled: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderPrimaryHoursBefore: z.coerce.number().refine((n) => [24, 48, 72].includes(n), "Pick 24, 48, or 72 hours"),
    reminderPrimaryEmail: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderPrimaryWhatsapp: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderPrimarySms: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderFinalEnabled: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderFinalHoursBefore: z.coerce.number().refine((n) => [1, 2, 5].includes(n), "Pick 1, 2, or 5 hours"),
    reminderFinalWhatsapp: z.preprocess((v) => v === true || v === "on", z.boolean()),
    reminderFinalSms: z.preprocess((v) => v === true || v === "on", z.boolean()),
    zoomSessionKind: z.nativeEnum(ZoomSessionKind)
  })
  .superRefine((data, ctx) => {
    if (!data.historicalMode && data.date.getTime() < Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Event date must be in the future unless Historical mode is enabled.",
        path: ["date"]
      });
    }
    if (data.endDate.getTime() <= data.date.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time.",
        path: ["endDate"]
      });
    }
    if (data.enableVirtual && data.virtualCapacity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set virtual capacity to at least 1 or turn off virtual.",
        path: ["virtualCapacity"]
      });
    }
  });

export type EventFormValues = z.infer<typeof schema>;

type EventFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  eventStatus?: EventStatus;
  locations: EventLocationOption[];
  defaultValues?: Partial<EventFormValues>;
  /** After a Zoom ID exists, session type cannot change without breaking stored links. */
  zoomSessionKindLocked?: boolean;
};

export function EventForm({
  mode,
  eventId,
  eventStatus,
  locations,
  defaultValues,
  zoomSessionKindLocked = false
}: EventFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const locked =
    mode === "edit" &&
    (eventStatus === EventStatus.COMPLETED || eventStatus === EventStatus.CANCELLED);

  const initialStart = defaultValues?.date ?? defaultStartDate();
  const form = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      date: initialStart,
      endDate: defaultValues?.endDate ?? defaultEndFromStart(initialStart),
      locationId: defaultValues?.locationId ?? locations[0]?.id ?? "",
      capacity: defaultValues?.capacity ?? 50,
      enableVirtual: defaultValues?.enableVirtual ?? false,
      virtualCapacity: defaultValues?.virtualCapacity ?? 50,
      type: defaultValues?.type ?? EventType.IN_PERSON,
      historicalMode: defaultValues?.historicalMode ?? false,
      reminderPrimaryEnabled: defaultValues?.reminderPrimaryEnabled ?? true,
      reminderPrimaryHoursBefore: defaultValues?.reminderPrimaryHoursBefore ?? 24,
      reminderPrimaryEmail: defaultValues?.reminderPrimaryEmail ?? true,
      reminderPrimaryWhatsapp: defaultValues?.reminderPrimaryWhatsapp ?? false,
      reminderPrimarySms: defaultValues?.reminderPrimarySms ?? false,
      reminderFinalEnabled: defaultValues?.reminderFinalEnabled ?? true,
      reminderFinalHoursBefore: defaultValues?.reminderFinalHoursBefore ?? 2,
      reminderFinalWhatsapp: defaultValues?.reminderFinalWhatsapp ?? true,
      reminderFinalSms: defaultValues?.reminderFinalSms ?? false,
      zoomSessionKind: defaultValues?.zoomSessionKind ?? ZoomSessionKind.WEBINAR
    }
  });

  const enableVirtual = form.watch("enableVirtual");
  const type = form.watch("type");
  const historicalMode = form.watch("historicalMode");
  const startDate = form.watch("date");

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
        form.setValue("virtualCapacity", 50, { shouldValidate: true });
      }
      return;
    }
    if (form.getValues("enableVirtual")) {
      form.setValue("enableVirtual", false, { shouldValidate: true });
    }
  }, [form, type]);

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

  async function onSubmit(values: EventFormValues) {
    setFormError(null);
    const virtualRequired = values.type === EventType.VIRTUAL || values.type === EventType.HYBRID;
    const effectiveEnableVirtual = virtualRequired ? true : values.enableVirtual;
    const virtualCapacity = effectiveEnableVirtual ? Math.max(1, values.virtualCapacity) : 0;

    const payload = {
      name: values.name,
      description: values.description || undefined,
      date: values.date,
      endDate: values.endDate,
      locationId: values.locationId,
      capacity: values.capacity,
      virtualCapacity,
      type: values.type,
      reminderPrimaryEnabled: values.reminderPrimaryEnabled,
      reminderPrimaryHoursBefore: values.reminderPrimaryHoursBefore as 24 | 48 | 72,
      reminderPrimaryEmail: values.reminderPrimaryEmail,
      reminderPrimaryWhatsapp: values.reminderPrimaryWhatsapp,
      reminderPrimarySms: values.reminderPrimarySms,
      reminderFinalEnabled: values.reminderFinalEnabled,
      reminderFinalHoursBefore: values.reminderFinalHoursBefore as 1 | 2 | 5,
      reminderFinalWhatsapp: values.reminderFinalWhatsapp,
      reminderFinalSms: values.reminderFinalSms,
      zoomSessionKind: values.zoomSessionKind
    };

    const result =
      mode === "edit" && eventId
        ? await updateEvent(eventId, payload)
        : await createEvent(payload);

    if (!result.success || !result.data) {
      setFormError(result.error ?? "Could not save event");
      return;
    }

    router.push(`/events/${result.data.id}`);
    router.refresh();
  }

  if (locations.length === 0) {
    return (
      <div className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <p className="font-medium">Add a venue before creating an event.</p>
        <p className="mt-2 text-amber-900/90">
          Go to{" "}
          <Link href="/dashboard/settings?tab=locations" className="font-semibold underline">
            Settings → Locations
          </Link>{" "}
          and create at least one location for your organization.
        </p>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => router.push("/events")}>
          Back to events
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-5">
      {locked ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This event is {eventStatus?.toLowerCase()} and read-only. Save is disabled.
        </p>
      ) : null}
      <fieldset disabled={locked} className="space-y-5 disabled:cursor-not-allowed disabled:opacity-80">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Name
        </label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className={cn(
            "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
          )}
          {...form.register("description")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
                onChange={(d) =>
                  field.onChange(d ?? defaultEndFromStart(form.getValues("date")))
                }
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

      <div>
        <label htmlFor="locationId" className="mb-1 block text-sm font-medium text-slate-700">
          Venue
        </label>
        <select
          id="locationId"
          className={selectClass}
          {...form.register("locationId")}
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} — cap. {loc.capacity}
            </option>
          ))}
        </select>
        {form.formState.errors.locationId && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.locationId.message}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">Manage saved venues in Settings → Locations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="capacity" className="mb-1 block text-sm font-medium text-slate-700">
            In-person capacity
          </label>
          <Input id="capacity" type="number" min={1} {...form.register("capacity")} />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Event type</span>
          <select
            id="type"
            className={selectClass}
            {...form.register("type")}
          >
            <option value={EventType.IN_PERSON}>In person</option>
            <option value={EventType.VIRTUAL}>Virtual</option>
            <option value={EventType.HYBRID}>Hybrid</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            {...form.register("enableVirtual")}
            disabled={type === EventType.VIRTUAL || type === EventType.HYBRID}
          />
          Enable virtual attendance (Zoom)
        </label>
        {type === EventType.VIRTUAL || type === EventType.HYBRID ? (
          <p className="mt-2 text-xs text-slate-600">
            Virtual attendance is required for {type === EventType.VIRTUAL ? "Virtual" : "Hybrid"} events.
          </p>
        ) : null}
        {enableVirtual ? (
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="virtualCapacity" className="mb-1 block text-sm text-slate-700">
                Virtual capacity
              </label>
              <Input
                id="virtualCapacity"
                type="number"
                min={1}
                {...form.register("virtualCapacity", { valueAsNumber: true })}
              />
              {form.formState.errors.virtualCapacity && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.virtualCapacity.message}</p>
              )}
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">Virtual Zoom session</span>
              {zoomSessionKindLocked ? (
                <>
                  <p className="text-sm text-slate-600">
                    Type is fixed after Zoom is created:{" "}
                    <strong>
                      {form.getValues("zoomSessionKind") === ZoomSessionKind.MEETING ? "Meeting" : "Webinar"}
                    </strong>
                    .
                  </p>
                  <input type="hidden" {...form.register("zoomSessionKind")} />
                </>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-8">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      className="border-slate-300"
                      value={ZoomSessionKind.WEBINAR}
                      {...form.register("zoomSessionKind")}
                    />
                    Webinar
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
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
              <p className="mt-2 text-xs text-slate-600">
                Webinars need webinar scopes; meetings need meeting scopes (including registrant scopes for virtual
                guests). Credentials: Settings → Integrations, or server{" "}
                <code className="rounded bg-slate-100 px-1">ZOOM_*</code> fallback.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
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
              <select
                className={selectClass}
                {...form.register("reminderPrimaryHoursBefore", { valueAsNumber: true })}
              >
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
              <select
                className={selectClass}
                {...form.register("reminderFinalHoursBefore", { valueAsNumber: true })}
              >
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
        (eventStatus === EventStatus.PUBLISHED || eventStatus === EventStatus.LIVE) ? (
          <EventManualReminderSend
            eventId={eventId}
            primaryReminderEnabled={defaultValues?.reminderPrimaryEnabled ?? false}
            finalReminderEnabled={defaultValues?.reminderFinalEnabled ?? false}
          />
        ) : null}
      </div>

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? mode === "edit"
              ? "Saving…"
              : "Creating…"
            : mode === "edit"
              ? "Save changes"
              : "Create event"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(mode === "edit" && eventId ? `/events/${eventId}` : "/events")}>
          Cancel
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
