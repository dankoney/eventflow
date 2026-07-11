"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  EventBlueprintTemplate,
  EventScheduleMode,
  InternalStaffCheckInMode,
  InternalStaffEmailTemplateKind,
  InternalStaffNoticeKind,
  InternalStaffSmsTemplateKind
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";

import { AccommodationForm } from "@/components/event-wizard/AccommodationForm";
import { ResourcesForm } from "@/components/event-wizard/ResourcesForm";
import { InternalStaffNoticeForm, type InternalStaffNoticeSettings } from "@/components/event-wizard/InternalStaffNoticeForm";
import { StaffPolicyForm, type StaffPolicyDirectoryMeta } from "@/components/event-wizard/StaffPolicyForm";
import { TemplateLaunchpad } from "@/components/event-wizard/TemplateLaunchpad";
import { WizardProgress } from "@/components/event-wizard/WizardProgress";
import { WizardReadinessPanel } from "@/components/event-wizard/WizardReadinessPanel";
import { EventFormFields } from "@/components/events/EventFormFields";
import { firstValidationMessage, sessionRowErrorSummary, tryApplyMultiDayServerIssues } from "@/components/events/eventFormErrors";
import {
  eventFormSchema,
  type EventFormValues,
  getEventFormDefaultValues,
  type EventLocationOption,
  type OrgEventFormDefaults
} from "@/components/events/eventFormSchema";
import { Button } from "@/components/ui/Button";
import { createEvent, provisionEventAfterWizard } from "@/lib/actions/event.actions";
import { blueprintDefaults } from "@/lib/event-wizard/blueprints";
import {
  applyReadinessFieldErrors,
  clearReadinessFieldErrors
} from "@/lib/event-wizard/applyReadinessToForm";
import { hasBlockingIssues, readinessForStep } from "@/lib/event-wizard/readiness";
import { eventRequiresVirtualZoomIntegration } from "@/lib/events/virtualZoomRequirements";
import { verifyOrgZoomConnection } from "@/lib/actions/integration.actions";
import type { RegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import type { ResourceLinkRow } from "@/lib/event-wizard/resourceLinks";
import { resourceLinksPayloadSchema } from "@/lib/event-wizard/resourceLinks";
import { eventFormSectionsForWizardStep } from "@/lib/event-wizard/wizardEventFormSections";
import { triggerFieldsForWizardStep } from "@/lib/event-wizard/wizardEventFormTriggers";
import { wizardStepsForTemplate } from "@/lib/event-wizard/wizardSteps";
import { parseActionFieldError } from "@/lib/errors/actionFieldError";
import { buildCreateEventPayload } from "@/lib/events/eventFormPayload";
import { defaultInternalStaffAudience, type InternalStaffAudience } from "@/lib/internalStaff/audience";
import { blankStaffNoticeMailyDocument } from "@/lib/email/staffNoticeMergeTags";

type WizardManagerProps = {
  locations: EventLocationOption[];
  orgHasZoomCredentials: boolean;
  orgDefaults: OrgEventFormDefaults | null;
  hasGoogleMaps: boolean;
  staffDirectoryMeta: StaffPolicyDirectoryMeta | null;
};

export function WizardManager({
  locations,
  orgHasZoomCredentials,
  orgDefaults,
  hasGoogleMaps,
  staffDirectoryMeta
}: WizardManagerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"choose" | "wizard">("choose");
  const [template, setTemplate] = useState<EventBlueprintTemplate>(EventBlueprintTemplate.BLANK);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const virtualCapacityOnEnable = orgDefaults?.defaultVirtualCapacity ?? 100;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: getEventFormDefaultValues(locations, undefined, orgDefaults)
  });

  const [allowPublicRegistration, setAllowPublicRegistration] = useState(true);
  const [registrationProfile, setRegistrationProfile] = useState<RegistrationProfile>({
    requireCompany: false,
    requireJobTitle: false,
    requireStaffId: false,
    requireDepartment: false,
    enableSavedProfileLookup: false
  });
  const [accommodationTravelNotes, setAccommodationTravelNotes] = useState("");
  const [internalStaffAudience, setInternalStaffAudience] = useState<InternalStaffAudience>(
    defaultInternalStaffAudience()
  );
  const [internalStaffCheckInMode, setInternalStaffCheckInMode] = useState<InternalStaffCheckInMode>(
    InternalStaffCheckInMode.PERSONAL_LINK
  );
  const [internalStaffNotice, setInternalStaffNotice] = useState<InternalStaffNoticeSettings>({
    noticeKind: InternalStaffNoticeKind.TRAINING,
    emailTemplateKind: InternalStaffEmailTemplateKind.MEMORANDUM,
    smsTemplateKind: InternalStaffSmsTemplateKind.STANDARD,
    smsCustomText: "",
    emailCustomMailyJson: blankStaffNoticeMailyDocument(),
    noticeTo: "",
    noticeFrom: "",
    noticeCc: "",
    noticeSubject: "",
    noticeContext: "",
    meetingRoom: ""
  });
  const [allowFlashEntry, setAllowFlashEntry] = useState(true);
  const [resourceLinks, setResourceLinks] = useState<ResourceLinkRow[]>([]);

  const steps = useMemo(() => wizardStepsForTemplate(template), [template]);
  const currentStep = steps[stepIndex] ?? "review";

  const name = form.watch("name");
  const locationId = form.watch("locationId");
  const date = form.watch("date");
  const endDate = form.watch("endDate");
  const type = form.watch("type");
  const virtualCapacity = form.watch("virtualCapacity");
  const scheduleMode = form.watch("scheduleMode");
  const bannerImageUrl = form.watch("bannerImageUrl");
  const brandLogoUrl = form.watch("brandLogoUrl");
  const brandPrimaryColor = form.watch("brandPrimaryColor");

  const readinessDraft = useMemo(
    () => ({
      name,
      locationId,
      date,
      endDate,
      type,
      virtualCapacity
    }),
    [name, locationId, date, endDate, type, virtualCapacity]
  );

  const readinessIssues = useMemo(() => {
    const branding = { bannerImageUrl: bannerImageUrl ?? "", brandLogoUrl: brandLogoUrl ?? "", brandPrimaryColor: brandPrimaryColor ?? "" };
    const extra = {
      template,
      internalStaffAudience,
      resourceLinks,
      branding
    };
    if (currentStep === "review") {
      return [
        ...readinessForStep("branding", readinessDraft, orgHasZoomCredentials, extra),
        ...readinessForStep("event_information", readinessDraft, orgHasZoomCredentials, extra),
        ...readinessForStep("schedule", readinessDraft, orgHasZoomCredentials, extra),
        ...readinessForStep("venue", readinessDraft, orgHasZoomCredentials, extra),
        ...(template === EventBlueprintTemplate.CONFERENCE
          ? readinessForStep("accommodation", readinessDraft, orgHasZoomCredentials, extra)
          : []),
        ...(template === EventBlueprintTemplate.INTERNAL_STAFF
          ? readinessForStep("staff_policy", readinessDraft, orgHasZoomCredentials, extra)
          : []),
        ...(template === EventBlueprintTemplate.TRAINING_WORKSHOP
          ? readinessForStep("resources", readinessDraft, orgHasZoomCredentials, extra)
          : []),
        ...readinessForStep("promotion", readinessDraft, orgHasZoomCredentials, extra)
      ];
    }
    return readinessForStep(currentStep, readinessDraft, orgHasZoomCredentials, extra);
  }, [
    currentStep,
    readinessDraft,
    orgHasZoomCredentials,
    template,
    internalStaffAudience,
    resourceLinks,
    bannerImageUrl,
    brandLogoUrl,
    brandPrimaryColor
  ]);

  const startWizard = useCallback(
    (t: EventBlueprintTemplate) => {
      const d = blueprintDefaults(t);
      setTemplate(t);
      setRegistrationProfile(d.registrationProfile);
      setAllowPublicRegistration(d.allowPublicRegistration);
      setAllowFlashEntry(d.allowFlashEntry);
      setInternalStaffAudience(defaultInternalStaffAudience());
      setInternalStaffCheckInMode(InternalStaffCheckInMode.PERSONAL_LINK);
      setInternalStaffNotice({
        noticeKind: InternalStaffNoticeKind.TRAINING,
        emailTemplateKind: InternalStaffEmailTemplateKind.MEMORANDUM,
        smsTemplateKind: InternalStaffSmsTemplateKind.STANDARD,
        smsCustomText: "",
        emailCustomMailyJson: blankStaffNoticeMailyDocument(),
        noticeTo: "",
        noticeFrom: "",
        noticeCc: "",
        noticeSubject: "",
        noticeContext: "",
        meetingRoom: ""
      });
      setAccommodationTravelNotes("");
      setResourceLinks([]);
      form.reset(getEventFormDefaultValues(locations, undefined, orgDefaults));
      setPhase("wizard");
      setStepIndex(0);
      setSubmitError(null);
    },
    [locations, form, orgDefaults]
  );

  const canGoNext = !hasBlockingIssues(readinessIssues);

  useEffect(() => {
    clearReadinessFieldErrors(form);
    setSubmitError(null);
  }, [stepIndex, form]);

  async function next() {
    const fields = triggerFieldsForWizardStep(currentStep);
    if (fields && fields.length > 0) {
      const ok = await form.trigger(fields, { shouldFocus: true });
      if (!ok) {
        const errs = form.formState.errors;
        setSubmitError(sessionRowErrorSummary(errs) ?? firstValidationMessage(errs) ?? "Fix the highlighted fields on this step.");
        return;
      }
    }

    if (!canGoNext) {
      const summary = applyReadinessFieldErrors(form, readinessIssues);
      setSubmitError(summary ?? "Resolve the items in the readiness check before continuing.");
      const firstField = readinessIssues.find((i) => i.severity === "block" && i.field)?.field;
      if (firstField) form.setFocus(firstField);
      return;
    }

    if (currentStep === "venue" && eventRequiresVirtualZoomIntegration(type) && orgHasZoomCredentials) {
      setBusy(true);
      const zoomCheck = await verifyOrgZoomConnection();
      setBusy(false);
      if (!zoomCheck.success) {
        form.setError("virtualCapacity", {
          type: "manual",
          message: zoomCheck.error ?? "Could not verify Zoom connection."
        });
        setSubmitError(zoomCheck.error ?? "Could not verify Zoom connection.");
        return;
      }
      if (zoomCheck.data?.status !== "healthy") {
        const detail =
          zoomCheck.data?.detail ??
          "Zoom connection failed — open Settings → Integrations, fix credentials, and use Test connection.";
        form.setError("virtualCapacity", { type: "manual", message: detail });
        setSubmitError(detail);
        return;
      }
    }

    setSubmitError(null);
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
  }

  function back() {
    setSubmitError(null);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else setPhase("choose");
  }

  async function finalize() {
    setSubmitError(null);
    if (!canGoNext) {
      const summary = applyReadinessFieldErrors(form, readinessIssues);
      setSubmitError(summary ?? "Resolve all readiness items on the review step before creating.");
      return;
    }
    const parsedLinks = resourceLinksPayloadSchema.safeParse(resourceLinks.filter((r) => r.title || r.url));
    if (!parsedLinks.success) {
      setSubmitError("Fix resource links: each row needs a title and valid https URL.");
      return;
    }
    const linksToSave = parsedLinks.data.length > 0 ? parsedLinks.data : null;

    const ok = await form.trigger();
    if (!ok) {
      const errs = form.formState.errors;
      setSubmitError(sessionRowErrorSummary(errs) ?? firstValidationMessage(errs) ?? "Fix highlighted fields.");
      return;
    }

    const values = form.getValues();
    setBusy(true);
    const base = buildCreateEventPayload(values);
    const res = await createEvent({
      ...base,
      blueprintTemplate: template,
      allowPublicRegistration,
      allowFlashEntry,
      registrationProfile: registrationProfile as unknown as Record<string, unknown>,
      accommodationTravelNotes: accommodationTravelNotes.trim() || null,
      resourceLinks: linksToSave,
      internalStaffAudience:
        template === EventBlueprintTemplate.INTERNAL_STAFF ? internalStaffAudience : null,
      internalStaffCheckInMode: template === EventBlueprintTemplate.INTERNAL_STAFF ? internalStaffCheckInMode : undefined,
      internalStaffNoticeKind:
        template === EventBlueprintTemplate.INTERNAL_STAFF ? internalStaffNotice.noticeKind : undefined,
      internalStaffEmailTemplateKind:
        template === EventBlueprintTemplate.INTERNAL_STAFF ? internalStaffNotice.emailTemplateKind : undefined,
      internalStaffSmsTemplateKind:
        template === EventBlueprintTemplate.INTERNAL_STAFF ? internalStaffNotice.smsTemplateKind : undefined,
      internalStaffSmsCustomText:
        template === EventBlueprintTemplate.INTERNAL_STAFF && internalStaffNotice.smsTemplateKind === InternalStaffSmsTemplateKind.BLANK
          ? internalStaffNotice.smsCustomText.trim() || null
          : undefined,
      internalStaffEmailMailyJson:
        template === EventBlueprintTemplate.INTERNAL_STAFF &&
        internalStaffNotice.emailTemplateKind === InternalStaffEmailTemplateKind.BLANK
          ? (internalStaffNotice.emailCustomMailyJson as Record<string, unknown>)
          : undefined,
      internalStaffNoticeFrom:
        template === EventBlueprintTemplate.INTERNAL_STAFF
          ? internalStaffNotice.noticeFrom.trim() || null
          : undefined,
      internalStaffNoticeTo:
        template === EventBlueprintTemplate.INTERNAL_STAFF
          ? internalStaffNotice.noticeTo.trim() || null
          : undefined,
      internalStaffNoticeCc:
        template === EventBlueprintTemplate.INTERNAL_STAFF ? internalStaffNotice.noticeCc.trim() || null : undefined,
      internalStaffNoticeContext:
        template === EventBlueprintTemplate.INTERNAL_STAFF
          ? internalStaffNotice.noticeContext.trim() || null
          : undefined,
      internalStaffNoticeSubject:
        template === EventBlueprintTemplate.INTERNAL_STAFF
          ? internalStaffNotice.noticeSubject.trim() || null
          : undefined,
      internalStaffMeetingRoom:
        template === EventBlueprintTemplate.INTERNAL_STAFF
          ? internalStaffNotice.meetingRoom.trim() || null
          : undefined
    });
    if (!res.success || !res.data) {
      setBusy(false);
      const err = res.error ?? "Could not create event.";
      const fieldErr = parseActionFieldError(err);
      if (fieldErr) {
        form.setError(fieldErr.field as FieldPath<EventFormValues>, {
          type: "manual",
          message: fieldErr.message
        });
        setSubmitError(fieldErr.message);
        const venueIdx = steps.indexOf("venue");
        if (venueIdx >= 0) setStepIndex(venueIdx);
      } else {
        setSubmitError(err);
      }
      if (values.scheduleMode === EventScheduleMode.MULTI_DAY) {
        tryApplyMultiDayServerIssues(form, err);
      }
      return;
    }
    const prov = await provisionEventAfterWizard({ eventId: res.data.id, publish: false });
    setBusy(false);
    if (!prov.success) {
      setSubmitError(prov.error ?? "Event was created but provisioning failed.");
      router.push(`/events/${res.data.id}/edit`);
      router.refresh();
      return;
    }
    router.push(`/events/${res.data.id}/publish`);
    router.refresh();
  }

  const eventFormSlice = eventFormSectionsForWizardStep(currentStep);

  const bannerTrim = bannerImageUrl?.trim() ?? "";
  const logoTrim = brandLogoUrl?.trim() ?? "";
  const colorTrim = brandPrimaryColor?.trim() ?? "";

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <p className="font-medium">Add a venue first</p>
        <p className="mt-2">Create a location under Settings, then return to launch the wizard.</p>
      </div>
    );
  }

  if (phase === "choose") {
    return <TemplateLaunchpad onSelect={startWizard} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <WizardProgress steps={steps} currentIndex={stepIndex} />
        </div>
        <p className="shrink-0 text-right text-xs font-medium tabular-nums text-slate-500 sm:pt-2">
          Step {stepIndex + 1} of {steps.length}
        </p>
      </div>

      <WizardReadinessPanel issues={readinessIssues} />

      {eventFormSlice ? (
        <EventFormFields
          form={form}
          locations={locations}
          activeSections={eventFormSlice}
          mode="create"
          virtualCapacityOnEnable={virtualCapacityOnEnable}
          hasGoogleMaps={hasGoogleMaps}
        />
      ) : null}

      {currentStep === "accommodation" ? (
        <AccommodationForm value={accommodationTravelNotes} onChange={setAccommodationTravelNotes} />
      ) : null}

      {currentStep === "staff_policy" ? (
        <StaffPolicyForm
          audience={internalStaffAudience}
          onAudienceChange={setInternalStaffAudience}
          directoryMeta={staffDirectoryMeta}
          internalStaffCheckInMode={internalStaffCheckInMode}
          onInternalStaffCheckInModeChange={setInternalStaffCheckInMode}
          allowFlashEntry={allowFlashEntry}
          onAllowFlashEntryChange={setAllowFlashEntry}
        />
      ) : null}

      {currentStep === "staff_notice" ? (
        <InternalStaffNoticeForm value={internalStaffNotice} onChange={setInternalStaffNotice} />
      ) : null}

      {currentStep === "resources" ? <ResourcesForm rows={resourceLinks} onChange={setResourceLinks} /> : null}

      {currentStep === "promotion" ? (
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            These options apply when the program is published (from <span className="font-medium">Events → Publish</span>).
            Conference and training blueprints keep public registration on by default so you can scale RSVPs.
          </p>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={allowPublicRegistration}
              onChange={(e) => setAllowPublicRegistration(e.target.checked)}
            />
            <span>
              <span className="font-medium text-slate-900">Allow public self-registration</span>
              <span className="mt-1 block text-slate-600">
                Turn off for invite-only programs (internal staff blueprint already disables this).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={allowFlashEntry}
              onChange={(e) => setAllowFlashEntry(e.target.checked)}
            />
            <span>
              <span className="font-medium text-slate-900">Allow Command Center walk-ins</span>
              <span className="mt-1 block text-slate-600">
                When someone&apos;s email is not on the guest list or CRM, they can still register from the org lobby
                (<span className="font-mono text-xs">/o/…</span>) if this stays on.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={registrationProfile.enableSavedProfileLookup}
              onChange={(e) =>
                setRegistrationProfile((p) => ({ ...p, enableSavedProfileLookup: e.target.checked }))
              }
            />
            <span>
              <span className="font-medium text-slate-900">Show &quot;Load my saved profile&quot; on registration</span>
              <span className="mt-1 block text-slate-600">
                Lets returning guests and CRM contacts prefill the form with email and/or mobile. You can change this
                later under Event settings.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {currentStep === "review" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Summary</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Template</dt>
              <dd className="font-medium text-slate-900">{template.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{name.trim() || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Venue</dt>
              <dd>{locations.find((l) => l.id === locationId)?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Schedule</dt>
              <dd>{scheduleMode === EventScheduleMode.MULTI_DAY ? "Multi-day" : "Single block"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Public registration</dt>
              <dd>{allowPublicRegistration ? "On" : "Off"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Command Center walk-ins</dt>
              <dd>{allowFlashEntry ? "On" : "Off"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Format</dt>
              <dd>{type}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Branding</dt>
              <dd>
                {[
                  !bannerTrim && "Title-only hero (no banner image)",
                  bannerTrim && (bannerTrim.startsWith("/uploads/") ? "Banner (uploaded)" : "Banner (URL)"),
                  logoTrim && "Logo",
                  colorTrim && "Color"
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
          </dl>
          <p className="rounded-lg border border-slate-200/90 bg-slate-50/95 px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200/20">
            The program is saved as a <span className="font-medium text-slate-800">draft</span>. To open the public
            registration page, go to <span className="font-medium text-slate-800">Events → Publish</span> after
            you finish.
          </p>
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="secondary" onClick={back} disabled={busy}>
          {stepIndex === 0 ? "Change blueprint" : "Back"}
        </Button>
        {currentStep === "review" ? (
          <Button type="button" onClick={() => void finalize()} disabled={busy || !canGoNext}>
            {busy ? "Working…" : "Create program"}
          </Button>
        ) : (
          <Button type="button" onClick={() => void next()} disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
