"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EventScheduleMode, EventStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, type FieldPath, type SubmitErrorHandler } from "react-hook-form";

import type { EventFormFieldsSection } from "@/components/events/EventFormFields";
import { EventFormFields } from "@/components/events/EventFormFields";
import {
  firstValidationMessage,
  sessionRowErrorSummary,
  tryApplyMultiDayServerIssues
} from "@/components/events/eventFormErrors";
import {
  eventFormSchema,
  type EventFormValues,
  getEventFormDefaultValues,
  type EventLocationOption,
  type OrgEventFormDefaults
} from "@/components/events/eventFormSchema";
import { Button } from "@/components/ui/Button";
import { FormStepFeedbackPanel, type FormStepIssue } from "@/components/ui/FormStepFeedbackPanel";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { parseActionFieldError } from "@/lib/errors/actionFieldError";
import { eventRequiresVirtualZoomIntegration } from "@/lib/events/virtualZoomRequirements";
import { verifyOrgZoomConnection } from "@/lib/actions/integration.actions";
import { createEvent, updateEvent } from "@/lib/actions/event.actions";
import { buildCreateEventPayload } from "@/lib/events/eventFormPayload";
import { cn } from "@/lib/utils";

export type { EventLocationOption, EventFormValues, OrgEventFormDefaults };

const EDIT_WIZARD_STEPS: {
  title: string;
  description: string;
  sections: EventFormFieldsSection[];
  roots: readonly (keyof EventFormValues)[];
}[] = [
  {
    title: "Event information",
    description: "Event name, description, and format (in person, hybrid, or virtual).",
    sections: ["nameDescription"],
    roots: ["name", "description", "type"]
  },
  {
    title: "Schedule",
    description: "Program window, historical mode, single block vs multi-day sessions, and per-day Zoom links.",
    sections: ["schedule"],
    roots: [
      "date",
      "endDate",
      "historicalMode",
      "scheduleMode",
      "multiDayDays",
      "multiDayVirtualLinkMode",
      "multiDayRegistrationPolicy",
      "multiDayCheckInPolicy",
      "multiDayShowAgendaPublic",
      "multiDayAllowStaffCheckInOutsideSession"
    ]
  },
  {
    title: "Venue",
    description: "Venue, capacities, and how virtual Zoom sessions are created.",
    sections: ["venueAttendance"],
    roots: [
      "locationId",
      "capacity",
      "enableVirtual",
      "virtualCapacity",
      "zoomSessionKind",
      "zoomPasscodeMode",
      "zoomCustomPasscode"
    ]
  },
  {
    title: "Branding",
    description: "Banner, logo, theme, and colors for registration and attendee touchpoints.",
    sections: ["identity"],
    roots: ["bannerImageUrl", "brandLogoUrl", "attendeeTheme", "brandPrimaryColor"]
  }
];

function issueRootKey(path: (string | number)[]): string | undefined {
  const head = path[0];
  if (head === undefined) return undefined;
  return String(head);
}

function issueBlocksStep(issue: { path: (string | number)[] }, allowed: ReadonlySet<string>): boolean {
  const root = issueRootKey(issue.path);
  if (!root) return false;
  return allowed.has(root);
}

type EventFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  eventStatus?: EventStatus;
  locations: EventLocationOption[];
  defaultValues?: Partial<EventFormValues>;
  zoomSessionKindLocked?: boolean;
  /** Organization defaults from Settings → General (new events only; omit on edit). */
  orgDefaults?: OrgEventFormDefaults | null;
  hasGoogleMaps?: boolean;
  /**
   * When `mode` is `edit` and the event is editable, use a stepped layout (default true).
   * Set `false` to show the full single-page form.
   */
  editWizard?: boolean;
};

export function EventForm({
  mode,
  eventId,
  eventStatus,
  locations,
  defaultValues,
  zoomSessionKindLocked = false,
  orgDefaults = null,
  hasGoogleMaps = false,
  editWizard
}: EventFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [stepIssues, setStepIssues] = useState<FormStepIssue[]>([]);
  const [wizardStep, setWizardStep] = useState(0);
  const submitAreaRef = useRef<HTMLDivElement>(null);
  const wizardShellRef = useRef<HTMLDivElement>(null);
  const locked =
    mode === "edit" &&
    (eventStatus === EventStatus.COMPLETED || eventStatus === EventStatus.CANCELLED);

  /** Same stepped shell for all edit sessions; completed/cancelled events stay read-only via `locked`. */
  const useEditWizard = mode === "edit" && editWizard !== false;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: getEventFormDefaultValues(locations, defaultValues, mode === "create" ? orgDefaults : null)
  });

  function scrollSubmitAreaIntoView() {
    requestAnimationFrame(() => {
      submitAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function onSubmit(values: EventFormValues) {
    setFormError(null);
    if (values.scheduleMode === EventScheduleMode.MULTI_DAY) {
      form.clearErrors("multiDayDays");
    }
    const payload = buildCreateEventPayload(values);

    const result =
      mode === "edit" && eventId ? await updateEvent(eventId, payload) : await createEvent(payload);

    if (!result.success || !result.data) {
      const err = result.error ?? "Could not save event";
      const fieldErr = parseActionFieldError(err);
      if (fieldErr) {
        form.setError(fieldErr.field as FieldPath<EventFormValues>, {
          type: "manual",
          message: fieldErr.message
        });
        setFormError(fieldErr.message);
        if (useEditWizard) {
          const venueStep = EDIT_WIZARD_STEPS.findIndex((s) => s.sections.includes("venueAttendance"));
          if (venueStep >= 0) setWizardStep(venueStep);
        }
      } else {
        setFormError(err);
      }
      if (values.scheduleMode === EventScheduleMode.MULTI_DAY) {
        tryApplyMultiDayServerIssues(form, err);
      }
      scrollSubmitAreaIntoView();
      return;
    }

    router.push(`/events/${result.data.id}`);
    router.refresh();
  }

  const onInvalid: SubmitErrorHandler<EventFormValues> = (errs) => {
    const rowMsg = sessionRowErrorSummary(errs);
    setFormError(rowMsg ?? firstValidationMessage(errs) ?? "Please correct the highlighted fields before saving.");
    scrollSubmitAreaIntoView();
  };

  async function goNext() {
    setFormError(null);
    setStepIssues([]);
    const parsed = eventFormSchema.safeParse(form.getValues());
    const allowed = new Set(EDIT_WIZARD_STEPS[wizardStep].roots.map((r) => String(r)));

    if (!parsed.success) {
      const relevant = parsed.error.issues.filter((issue) => issueBlocksStep(issue, allowed));
      if (relevant.length) {
        form.clearErrors();
        const issues: FormStepIssue[] = [];
        for (const issue of relevant) {
          const pathJoined = issue.path.join(".") as FieldPath<EventFormValues>;
          const msg = issue.message ?? "Invalid";
          form.setError(pathJoined, { type: "manual", message: msg });
          const root = issue.path[0];
          issues.push({
            id: String(root),
            severity: "block",
            message: msg,
            field: typeof root === "string" ? (root as FormStepIssue["field"]) : undefined
          });
        }
        setStepIssues(issues);
        setFormError(issues.map((i) => i.message).join(" "));
        scrollSubmitAreaIntoView();
        return;
      }
    }

    const values = form.getValues();
    const venueStepIndex = EDIT_WIZARD_STEPS.findIndex((s) => s.sections.includes("venueAttendance"));
    if (wizardStep === venueStepIndex && eventRequiresVirtualZoomIntegration(values.type)) {
      const zoomCheck = await verifyOrgZoomConnection();
      if (!zoomCheck.success) {
        form.setError("virtualCapacity", { type: "manual", message: zoomCheck.error ?? "Zoom check failed" });
        setFormError(zoomCheck.error ?? "Zoom check failed");
        return;
      }
      if (zoomCheck.data?.status !== "healthy") {
        const detail = zoomCheck.data?.detail ?? "Fix Zoom under Settings → Integrations.";
        form.setError("virtualCapacity", { type: "manual", message: detail });
        setStepIssues([{ id: "zoom_org", severity: "block", message: detail, field: "virtualCapacity" }]);
        setFormError(detail);
        return;
      }
    }

    form.clearErrors();
    setWizardStep((s) => Math.min(s + 1, EDIT_WIZARD_STEPS.length - 1));
    requestAnimationFrame(() => {
      wizardShellRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function goBack() {
    setFormError(null);
    form.clearErrors();
    setWizardStep((s) => Math.max(0, s - 1));
    requestAnimationFrame(() => {
      wizardShellRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function goToStep(index: number) {
    setFormError(null);
    form.clearErrors();
    setWizardStep(() => Math.max(0, Math.min(index, EDIT_WIZARD_STEPS.length - 1)));
    requestAnimationFrame(() => {
      wizardShellRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const lastWizardStep = wizardStep === EDIT_WIZARD_STEPS.length - 1;
  const activeSections: EventFormFieldsSection[] | undefined = useEditWizard
    ? [...EDIT_WIZARD_STEPS[wizardStep].sections]
    : undefined;

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
    <form
      onSubmit={(e) => {
        const sub = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | undefined;
        if (useEditWizard && !lastWizardStep && sub?.dataset.wizardAction === "next") {
          e.preventDefault();
          goNext();
          return;
        }
        void form.handleSubmit(onSubmit, onInvalid)(e);
      }}
      className={cn("space-y-6", useEditWizard ? "max-w-4xl" : "max-w-2xl")}
    >
      {locked ? (
        <WorkspaceNotice variant="info">
          This event is {eventStatus === EventStatus.COMPLETED ? "completed" : "cancelled"}. Fields are read-only; use
          the steps to review. Saving is disabled.
        </WorkspaceNotice>
      ) : null}
      {useEditWizard ? (
        <div
          ref={wizardShellRef}
          className="overflow-hidden rounded-2xl border-2 border-zinc-900 bg-zinc-50 shadow-[6px_6px_0_0_rgb(24_24_27)]"
        >
          <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 sm:py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Edit wizard</p>
            <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Edit wizard steps">
              {EDIT_WIZARD_STEPS.map((st, i) => (
                <button
                  key={st.title}
                  type="button"
                  role="tab"
                  aria-selected={i === wizardStep}
                  onClick={() => goToStep(i)}
                  aria-label={`${st.title}, step ${i + 1} of ${EDIT_WIZARD_STEPS.length}`}
          className={cn(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/80 focus-visible:ring-offset-2",
                    i === wizardStep
                      ? "bg-zinc-900 text-white ring-2 ring-zinc-400/90"
                      : i < wizardStep
                        ? "bg-zinc-200 text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-300/90"
                        : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-100 hover:text-zinc-800"
                  )}
                >
                  {i + 1}. {st.title}
                      </button>
              ))}
            </div>
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900" id="edit-wizard-step-title">
                {EDIT_WIZARD_STEPS[wizardStep].title}
              </h2>
              <p className="mt-1 text-sm text-zinc-600" id="edit-wizard-step-desc">
                {EDIT_WIZARD_STEPS[wizardStep].description}
              </p>
            </div>
      </div>

          <fieldset
            disabled={locked}
            className="min-w-0 border-0 p-0 disabled:cursor-not-allowed disabled:opacity-[0.88]"
          >
            <div
              id="edit-wizard-panel"
              className="space-y-5 bg-white px-4 py-5 sm:px-6 sm:py-6"
              role="tabpanel"
              aria-labelledby="edit-wizard-step-title"
              aria-describedby="edit-wizard-step-desc"
            >
              <FormStepFeedbackPanel issues={stepIssues} />
              <EventFormFields
                form={form}
                locations={locations}
                locked={locked}
                mode={mode}
                eventId={eventId}
                eventStatus={eventStatus}
                zoomSessionKindLocked={zoomSessionKindLocked}
                defaultValues={defaultValues}
                activeSections={activeSections}
                virtualCapacityOnEnable={orgDefaults?.defaultVirtualCapacity ?? 100}
                hasGoogleMaps={hasGoogleMaps}
              />
            </div>
          </fieldset>
        </div>
      ) : (
        <fieldset
          disabled={locked}
          className="min-w-0 space-y-6 border-0 p-0 disabled:cursor-not-allowed disabled:opacity-[0.88]"
        >
          <EventFormFields
            form={form}
            locations={locations}
            locked={locked}
            mode={mode}
            eventId={eventId}
            eventStatus={eventStatus}
            zoomSessionKindLocked={zoomSessionKindLocked}
            defaultValues={defaultValues}
            activeSections={activeSections}
            virtualCapacityOnEnable={orgDefaults?.defaultVirtualCapacity ?? 100}
            hasGoogleMaps={hasGoogleMaps}
          />
        </fieldset>
      )}

      <div ref={submitAreaRef} className="space-y-3 scroll-mt-8">
        {formError ? (
          <WorkspaceNotice variant="error" onDismiss={() => setFormError(null)}>
            {formError}
          </WorkspaceNotice>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {useEditWizard && wizardStep > 0 ? (
            <Button type="button" variant="secondary" className="w-full border-zinc-200 sm:w-auto" onClick={goBack}>
              Back
            </Button>
          ) : null}
          {useEditWizard && !lastWizardStep ? (
            <>
              <Button
                type="submit"
                disabled={locked || form.formState.isSubmitting}
                className="w-full sm:w-auto"
              >
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
              <Button
                type="submit"
                data-wizard-action="next"
                disabled={locked || form.formState.isSubmitting}
                className="w-full bg-zinc-900 font-semibold text-white hover:bg-zinc-800 sm:w-auto"
              >
                Continue
              </Button>
            </>
          ) : null}
          {(!useEditWizard || lastWizardStep) && (
            <Button
              type="submit"
              disabled={locked || form.formState.isSubmitting}
              className="w-full sm:w-auto"
            >
            {form.formState.isSubmitting
              ? mode === "edit"
                ? "Saving…"
                : "Creating…"
              : mode === "edit"
                ? "Save changes"
                : "Create event"}
          </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full border-zinc-200 sm:w-auto"
            onClick={() => router.push(mode === "edit" && eventId ? `/events/${eventId}` : "/events")}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
