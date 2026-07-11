"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AttendMode, EventType } from "@prisma/client";
import { ArrowRight, ChevronLeft, Info, Vote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { FormStepFeedbackPanel, type FormStepIssue } from "@/components/ui/FormStepFeedbackPanel";
import { firstValidationMessage } from "@/components/events/eventFormErrors";
import {
  TechnexusRegistrationSuccess,
  TechnexusWaitlistSuccess
} from "@/components/register/public-event/templates/technexus/TechnexusRegistrationFeedback";
import { PollEligibilityCard } from "@/components/register/PollEligibilityCard";
import { MarketingOptInCheckbox } from "@/components/register/MarketingOptInCheckbox";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { joinEventWaitlist } from "@/lib/actions/rsvp.actions";
import { lookupPublicRegistrationProfile, publicRegisterGuest } from "@/lib/actions/guest.actions";
import type { PublicRegistrationEvent } from "@/lib/db/events";
import { eventHasVirtualJoinFromConfig } from "@/lib/event-schedule/multiDayConfig";
import type { RegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import type { GuestWithEmailStatus } from "@/types";
import {
  composeE164,
  isValidNationalForDial,
  normalizeNationalDigits
} from "@/lib/phone/publicRegistrationPhone";
import { DEFAULT_PHONE_DIAL, PHONE_DIAL_OPTIONS } from "@/lib/register/phoneDialOptions";
import { parseRegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import { guestEmailFieldSchema, isEmailMandatoryForEvent } from "@/lib/guest/contactRequirements";
import { formatMarketingConsentLabel, shouldShowMarketingOptIn } from "@/lib/email/marketingOptIn";
import { registrationConfirmationUserMessage } from "@/lib/register/registrationConfirmationCopy";
import { cn } from "@/lib/utils";

function selectFieldClass(dark: boolean, wide = false) {
  return cn(
    "w-full rounded-md border text-sm leading-normal outline-none transition focus:ring-2",
    wide ? "h-11 min-h-[2.75rem] px-3 py-2.5 sm:min-w-[14rem]" : "h-10 px-3",
    dark
      ? "border-white/10 bg-zinc-950 text-zinc-100 ring-zinc-700 focus:border-[color:var(--accent)] focus:ring-[color:var(--accent)]/30"
      : "border-slate-300 bg-white text-slate-900 ring-slate-300"
  );
}

const schemaBaseWithoutEmail = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name."),
  phoneDialCode: z.string().min(1),
  phoneNational: z.string().trim().min(1, "Mobile number is required."),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  mode: z.nativeEnum(AttendMode)
});

function buildSchema(
  allowsInPerson: boolean,
  allowsVirtual: boolean,
  reg: RegistrationProfile,
  emailRequired: boolean
) {
  return schemaBaseWithoutEmail
    .extend({ email: guestEmailFieldSchema(emailRequired) })
    .superRefine((data, ctx) => {
    const national = normalizeNationalDigits(data.phoneNational, data.phoneDialCode);
    if (!isValidNationalForDial(data.phoneDialCode, national)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid mobile number for the selected country code.",
        path: ["phoneNational"]
      });
    }
    if (allowsInPerson && !allowsVirtual && data.mode !== AttendMode.IN_PERSON) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This event is in-person only.",
        path: ["mode"]
      });
    }
    if (allowsVirtual && !allowsInPerson && data.mode !== AttendMode.VIRTUAL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This event is virtual only.",
        path: ["mode"]
      });
    }
    if (reg.requireJobTitle && !data.jobTitle?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Job title is required for this event.",
        path: ["jobTitle"]
      });
    }
  });
}

function splitFullName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim().replace(/\s+/g, " ");
  if (!trimmed.includes(" ")) return { firstName: trimmed, lastName: trimmed };
  const parts = trimmed.split(" ");
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" ")
  };
}

type PublicRegistrationFormProps = {
  event: PublicRegistrationEvent;
  /** Shorter hero card: step 1 = contact + name, step 2 = org fields + mode + submit. */
  twoStep?: boolean;
  /** Switches to dark surfaces / borders / text so the form sits well on a dark hero card. */
  dark?: boolean;
  /** Template 3 light — light form chrome and dedicated success / waitlist feedback. */
  technexusLight?: boolean;
};

export function PublicRegistrationForm({
  event,
  twoStep = false,
  dark = false,
  technexusLight = false
}: PublicRegistrationFormProps) {
  const useDarkChrome = dark && !technexusLight;
  const registrationProfile = useMemo(
    () => parseRegistrationProfile(event.registrationProfile),
    [event.registrationProfile]
  );
  const [done, setDone] = useState(false);
  const [registeredMode, setRegisteredMode] = useState<AttendMode | null>(null);
  const [emailDelivered, setEmailDelivered] = useState(true);
  const [smsDelivered, setSmsDelivered] = useState(false);
  const [pollNotice, setPollNotice] = useState<NonNullable<GuestWithEmailStatus["poll"]> | null>(null);
  const [pollInstructionsOpen, setPollInstructionsOpen] = useState(false);
  const [waitlistResult, setWaitlistResult] = useState<{ position: number; promotedNow: boolean } | null>(null);
  const [capacityFull, setCapacityFull] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupHint, setLookupHint] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [stepIssues, setStepIssues] = useState<FormStepIssue[]>([]);
  const [modeChosen, setModeChosen] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const showMarketingOptIn = useMemo(
    () =>
      shouldShowMarketingOptIn(
        { blueprintTemplate: event.blueprintTemplate },
        {
          name: event.org.name,
          marketingEmailEnabled: event.org.marketingEmailEnabled,
          marketingConsentCopy: event.org.marketingConsentCopy,
          marketingPrivacyPolicyUrl: event.org.marketingPrivacyPolicyUrl
        }
      ),
    [event.blueprintTemplate, event.org]
  );
  const marketingConsentLabel = useMemo(
    () =>
      formatMarketingConsentLabel({
        name: event.org.name,
        marketingConsentCopy: event.org.marketingConsentCopy
      }),
    [event.org.name, event.org.marketingConsentCopy]
  );

  const allowsInPerson = event.type === EventType.IN_PERSON || event.type === EventType.HYBRID;
  const allowsVirtual =
    (event.type === EventType.VIRTUAL || event.type === EventType.HYBRID) &&
    event.virtualCapacity > 0 &&
    eventHasVirtualJoinFromConfig({
      virtualCapacity: event.virtualCapacity,
      scheduleMode: event.scheduleMode,
      multiDayConfig: event.multiDayConfig,
      zoomJoinUrl: event.zoomJoinUrl,
      zoomMeetingId: event.zoomMeetingId
    });

  const defaultMode = allowsVirtual && !allowsInPerson ? AttendMode.VIRTUAL : AttendMode.IN_PERSON;

  const emailMandatory = isEmailMandatoryForEvent(event);
  const schema = useMemo(
    () => buildSchema(allowsInPerson, allowsVirtual, registrationProfile, emailMandatory),
    [allowsInPerson, allowsVirtual, registrationProfile, emailMandatory]
  );
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneDialCode: DEFAULT_PHONE_DIAL,
      phoneNational: "",
      company: "",
      jobTitle: "",
      mode: defaultMode
    }
  });

  const phoneDialCode = form.watch("phoneDialCode") || DEFAULT_PHONE_DIAL;
  const phoneDialPrefix = `+${phoneDialCode}`;

  useEffect(() => {
    if (!allowsInPerson && allowsVirtual) {
      form.setValue("mode", AttendMode.VIRTUAL, { shouldValidate: true });
      setModeChosen(true);
    } else if (allowsInPerson && !allowsVirtual) {
      form.setValue("mode", AttendMode.IN_PERSON, { shouldValidate: true });
      setModeChosen(true);
    } else {
      setModeChosen(false);
    }
  }, [allowsInPerson, allowsVirtual, form]);

  async function onSubmit(values: FormValues) {
    if (twoStep && step === 1) {
      await goStep2();
      return;
    }
    const national = normalizeNationalDigits(values.phoneNational, values.phoneDialCode);
    const phone = composeE164(values.phoneDialCode, national);
    const { firstName, lastName } = splitFullName(values.fullName);
    const company = values.company?.trim() || undefined;
    const jobTitle = values.jobTitle?.trim() || undefined;

    if (registrationProfile.requireCompany && !company) {
      form.setError("company", { message: "Company is required." });
      return;
    }
    if (registrationProfile.requireJobTitle && !jobTitle) {
      form.setError("jobTitle", { message: "Job title is required." });
      return;
    }
    if (allowsInPerson && allowsVirtual && !modeChosen) {
      form.setError("mode", { message: "Please choose how you'll attend." });
      return;
    }

    const res = await publicRegisterGuest({
      eventId: event.id,
      firstName,
      lastName,
      email: values.email?.trim() || null,
      phone,
      company: company ?? null,
      jobTitle: jobTitle ?? null,
      mode: values.mode,
      marketingOptIn: showMarketingOptIn ? marketingOptIn : false
    });

    if (!res.success || !res.data) {
      const errMsg = res.error ?? "Registration failed";
      const isFull = /full for this event/i.test(errMsg);
      if (isFull) {
        setCapacityFull(true);
        form.setError("root", {
          message: `${errMsg} Add yourself to the waitlist below — we'll invite you the moment a spot opens.`
        });
      } else {
        form.setError("root", { message: errMsg });
      }
      return;
    }
    setEmailDelivered(res.data.emailDelivered);
    setSmsDelivered(res.data.smsDelivered);
    setPollNotice(res.data.poll ?? null);
    setRegisteredMode(values.mode);
    setDone(true);
  }

  async function joinWaitlist() {
    const values = form.getValues();
    const national = normalizeNationalDigits(values.phoneNational, values.phoneDialCode);
    const phone = composeE164(values.phoneDialCode, national);
    const ok = await form.trigger(["fullName", "email", "phoneNational"]);
    if (!ok) return;
    const res = await joinEventWaitlist({
      eventId: event.id,
      name: values.fullName.trim(),
      email: values.email?.trim() || "",
      phone,
      company: values.company?.trim() || null,
      preferredMode: values.mode
    });
    if (!res.success || !res.data) {
      form.setError("root", { message: res.error ?? "Could not join the waitlist." });
      return;
    }
    if (res.data.alreadyRegistered) {
      setEmailDelivered(true);
      setRegisteredMode(values.mode);
      setDone(true);
      return;
    }
    setWaitlistResult({
      position: res.data.position,
      promotedNow: false
    });
  }

  async function loadSavedProfile() {
    setLookupHint(null);
    const email = (form.getValues("email") ?? "").trim();
    const dial = form.getValues("phoneDialCode");
    const national = form.getValues("phoneNational").trim();
    if (!email && !national) {
      setLookupHint("Enter your work email or mobile number first.");
      return;
    }
    setLookupBusy(true);
    try {
      const res = await lookupPublicRegistrationProfile({
        eventId: event.id,
        email: email || undefined,
        phoneDialCode: dial,
        phoneNational: national || undefined
      });
      if (!res.success) {
        setLookupHint(res.error ?? "Could not look up your profile.");
        return;
      }
      if (!res.data) {
        setLookupHint("No saved profile found for that email or phone. You can still register manually.");
        return;
      }
      const d = res.data;
      const full = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
      const current = form.getValues();
      const dialMatched = PHONE_DIAL_OPTIONS.some((o) => o.value === d.phoneDialCode)
        ? d.phoneDialCode
        : current.phoneDialCode || DEFAULT_PHONE_DIAL;

      form.reset(
        {
          ...current,
          fullName: full || current.fullName,
          email: d.email?.trim() || current.email,
          phoneDialCode: dialMatched,
          phoneNational: d.phoneNational || current.phoneNational,
          company: d.company?.trim() || current.company,
          jobTitle: d.jobTitle?.trim() || current.jobTitle
        },
        { keepDefaultValues: true, keepDirty: false, keepTouched: false, keepErrors: false }
      );
      void form.trigger(["fullName", "email", "phoneDialCode", "phoneNational"]);
      setLookupHint("Details loaded — confirm and complete registration.");
    } finally {
      setLookupBusy(false);
    }
  }

  async function goStep2() {
    setStepIssues([]);
    const ok = await form.trigger(["email", "phoneDialCode", "phoneNational", "fullName"]);
    if (!ok) {
      const msg = firstValidationMessage(form.formState.errors) ?? "Fix the highlighted contact fields.";
      setStepIssues([{ id: "step1", severity: "block", message: msg }]);
      return;
    }
    setStep(2);
  }

  if (done && registeredMode) {
    const confirmationCopy = registrationConfirmationUserMessage({
      emailDelivered,
      smsDelivered,
      attendanceMode: registeredMode
    });

    if (technexusLight) {
      return (
        <TechnexusRegistrationSuccess
          emailDelivered={emailDelivered}
          smsDelivered={smsDelivered}
          registeredMode={registeredMode}
          pollNotice={pollNotice}
          pollInstructionsOpen={pollInstructionsOpen}
          onOpenPollInstructions={() => setPollInstructionsOpen(true)}
          onClosePollInstructions={() => setPollInstructionsOpen(false)}
        />
      );
    }

    return (
      <div className="space-y-4">
        <div
          className={cn(
            "rounded-lg border px-4 py-5",
            confirmationCopy.tone === "success"
              ? useDarkChrome
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
              : useDarkChrome
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-950"
          )}
        >
          <p className="font-semibold">You are registered.</p>
          <p
            className={cn(
              "mt-2 text-sm",
              confirmationCopy.tone === "success"
                ? useDarkChrome
                  ? "text-emerald-200"
                  : "text-emerald-800"
                : useDarkChrome
                  ? "text-amber-200"
                  : "text-amber-900"
            )}
          >
            {confirmationCopy.message}
          </p>
        </div>

        {pollNotice ? (
          <PollEligibilityCard
            poll={pollNotice}
            dark={useDarkChrome}
            onOpenInstructions={() => setPollInstructionsOpen(true)}
          />
        ) : null}

        {pollNotice ? (
          <Modal
            open={pollInstructionsOpen}
            title="How to vote"
            subtitle={pollNotice.title}
            size="md"
            onClose={() => setPollInstructionsOpen(false)}
          >
            <div className="space-y-4">
              {pollNotice.instructions?.trim() ? (
                <div className="flex items-start gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50/80 p-4 text-sm leading-relaxed text-zinc-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  <p className="whitespace-pre-wrap">{pollNotice.instructions.trim()}</p>
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  The organizer hasn&apos;t added specific voting instructions for this ballot.
                  You&apos;ll be guided through identity verification (OTP) and one ballot per
                  position when you open the link below.
                </p>
              )}
              {pollNotice.isAttributed ? (
                <p className="rounded-md border border-amber-300/70 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-900">
                  <strong>Attributed ballot:</strong> the organizer can see how each guest voted,
                  and you&apos;ll receive a copy of your selections after submitting.
                </p>
              ) : (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Your ballot is anonymous — only a participation flag is stored against your
                  profile.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Ballot window · {pollNotice.startTimeLabel} → {pollNotice.endTimeLabel}
              </p>
              <a
                href={pollNotice.ballotUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Vote className="h-4 w-4" aria-hidden />
                {pollNotice.inWindow ? "Cast your ballot" : "Open ballot page"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </Modal>
        ) : null}
      </div>
    );
  }

  if (waitlistResult) {
    if (technexusLight) {
      return <TechnexusWaitlistSuccess position={waitlistResult.position} />;
    }

    return (
      <div
        className={cn(
          "rounded-lg border px-4 py-5",
          useDarkChrome
            ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-100"
            : "border-indigo-200 bg-indigo-50 text-indigo-900"
        )}
      >
        <p className="font-semibold">You&apos;re on the waitlist.</p>
        <p className={cn("mt-2 text-sm", useDarkChrome ? "text-indigo-200" : "text-indigo-800")}>
          You are #{waitlistResult.position} in line. We&apos;ll email you the moment a spot opens —
          the invitation will let you confirm your attendance with one click.
        </p>
      </div>
    );
  }

  const showStep1 = !twoStep || step === 1;
  const showStep2 = !twoStep || step === 2;

  // Theme-aware utility classes — keep slate for light, zinc/white-alpha for dark.
  const labelClass = cn(
    "mb-1 block text-sm font-medium",
    useDarkChrome ? "text-zinc-300" : "text-slate-700"
  );
  const hintClass = cn("mt-1 text-xs", useDarkChrome ? "text-zinc-500" : "text-slate-500");
  const errorClass = cn("mt-1 text-sm", useDarkChrome ? "text-red-400" : "text-red-600");
  const calloutClass = cn(
    "col-span-1 rounded-lg border px-3 py-3 sm:col-span-2",
    useDarkChrome
      ? "border-white/10 bg-white/[0.04] text-zinc-200"
      : "border-slate-200 bg-slate-50/90 text-slate-800"
  );
  const lookupBtnClass = cn(
    useDarkChrome
      ? "border border-white/15 bg-white/10 text-zinc-100 hover:bg-white/15"
      : "bg-slate-100 text-slate-900 hover:bg-slate-200"
  );
  const inputDarkClass = useDarkChrome
    ? "border-white/10 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/30"
    : "";

  return (
    <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
      {!allowsInPerson && !allowsVirtual ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            useDarkChrome ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          Registration is open, but virtual attendance is not configured yet for this event. Ask the
          organizer to set virtual capacity and Zoom integration.
        </p>
      ) : null}

      {twoStep ? (
        <div
          className={cn(
            "mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
            useDarkChrome ? "text-zinc-500" : "text-slate-500"
          )}
        >
          <span className={cn(step === 1 && (useDarkChrome ? "text-zinc-100" : "text-slate-900"))}>1 · Contact</span>
          <span aria-hidden>/</span>
          <span className={cn(step === 2 && (useDarkChrome ? "text-zinc-100" : "text-slate-900"))}>2 · Details</span>
        </div>
      ) : null}

      {twoStep && stepIssues.length > 0 ? <FormStepFeedbackPanel issues={stepIssues} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {showStep1 ? (
          <>
            {registrationProfile.enableSavedProfileLookup ? (
              <div className={calloutClass}>
                <p className={cn("text-sm font-medium", useDarkChrome ? "text-zinc-100" : "text-slate-800")}>
                  Returning guest or on our CRM list? Enter your email and/or mobile below, then load your saved
                  details.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className={cn("mt-2", lookupBtnClass)}
                  disabled={lookupBusy}
                  onClick={() => void loadSavedProfile()}
                >
                  {lookupBusy ? "Looking up…" : "Load my saved profile"}
                </Button>
                {lookupHint ? (
                  <p className={cn("mt-2 text-xs", useDarkChrome ? "text-zinc-400" : "text-slate-600")}>{lookupHint}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className={labelClass}>
                Email
                {emailMandatory ? <span className="text-red-500"> *</span> : " (optional)"}
              </label>
              <Input
                type="email"
                {...form.register("email")}
                autoComplete="email"
                placeholder="you@company.com"
                className={inputDarkClass}
              />
              {form.formState.errors.email ? (
                <p className={errorClass}>{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div>
              <label className={labelClass}>Full name</label>
              <Input
                {...form.register("fullName")}
                autoComplete="name"
                placeholder="e.g. Alex Rivera"
                className={inputDarkClass}
              />
              {form.formState.errors.fullName ? (
                <p className={errorClass}>{form.formState.errors.fullName.message}</p>
              ) : null}
            </div>

            <div className="sm:col-span-2 space-y-3">
              <div className="grid gap-4 sm:grid-cols-[minmax(13rem,15rem)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <label className={labelClass}>Country</label>
                  <select
                    {...form.register("phoneDialCode")}
                    className={cn(selectFieldClass(useDarkChrome, true), "max-w-full")}
                  >
                    {PHONE_DIAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className={labelClass}>Mobile number</label>
                  <div
                    className={cn(
                      "flex min-h-[2.75rem] min-w-0 overflow-hidden rounded-md border focus-within:ring-2",
                      useDarkChrome
                        ? "border-white/10 bg-zinc-950 ring-zinc-700 focus-within:border-[color:var(--accent)] focus-within:ring-[color:var(--accent)]/30"
                        : "border-slate-300 bg-white ring-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "flex shrink-0 items-center border-r px-3 text-sm font-medium tabular-nums",
                        useDarkChrome
                          ? "border-white/10 bg-zinc-900/80 text-zinc-300"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                      aria-hidden
                    >
                      {phoneDialPrefix}
                    </span>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder={phoneDialCode === "233" ? "24 000 0000" : "Phone number"}
                      className={cn(
                        "min-h-[2.75rem] min-w-0 flex-1 border-0 bg-transparent py-2.5 shadow-none focus-visible:ring-0",
                        inputDarkClass
                      )}
                      {...form.register("phoneNational")}
                    />
                  </div>
                </div>
              </div>
              {form.formState.errors.phoneNational ? (
                <p className={errorClass}>{form.formState.errors.phoneNational.message}</p>
              ) : null}
              <p className={hintClass}>
                Select your country, then enter your mobile number after {phoneDialPrefix}
                {phoneDialCode === "233" ? " (omit a leading 0, e.g. 24XXXXXXX)." : "."}
              </p>
            </div>
          </>
        ) : null}
        {showStep2 ? (
          <>
            {twoStep ? (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-semibold transition",
                    useDarkChrome ? "text-zinc-400 hover:text-zinc-100" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Back to contact
                </button>
              </div>
            ) : null}

            <div>
              <label className={labelClass}>
                Company{registrationProfile.requireCompany ? null : " (optional)"}
                {registrationProfile.requireCompany ? <span className="text-red-500"> *</span> : null}
              </label>
              <Input
                {...form.register("company")}
                autoComplete="organization"
                placeholder="Where do you work?"
                className={inputDarkClass}
              />
              {form.formState.errors.company ? (
                <p className={errorClass}>{form.formState.errors.company.message}</p>
              ) : null}
            </div>

            <div>
              <label className={labelClass}>
                Job title{registrationProfile.requireJobTitle ? <span className="text-red-500"> *</span> : " (optional)"}
              </label>
              <Input
                {...form.register("jobTitle")}
                autoComplete="organization-title"
                placeholder="e.g. Product marketing lead"
                className={inputDarkClass}
              />
              {form.formState.errors.jobTitle ? (
                <p className={errorClass}>{form.formState.errors.jobTitle.message}</p>
              ) : null}
            </div>


            {allowsInPerson && allowsVirtual ? (
              <div className="sm:col-span-2">
                <p className={labelClass}>How will you attend?</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue("mode", AttendMode.IN_PERSON, { shouldValidate: true });
                      setModeChosen(true);
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left text-sm transition",
                      form.watch("mode") === AttendMode.IN_PERSON
                        ? useDarkChrome
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-zinc-50"
                          : "border-slate-900 bg-slate-900 text-white"
                        : useDarkChrome
                          ? "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/20"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                    )}
                  >
                    <span className="font-semibold">In person</span>
                    <span className={cn("mt-1 block text-xs", useDarkChrome ? "text-zinc-400" : "text-slate-500")}>
                      Join us at the venue
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue("mode", AttendMode.VIRTUAL, { shouldValidate: true });
                      setModeChosen(true);
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left text-sm transition",
                      form.watch("mode") === AttendMode.VIRTUAL
                        ? useDarkChrome
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-zinc-50"
                          : "border-slate-900 bg-slate-900 text-white"
                        : useDarkChrome
                          ? "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/20"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                    )}
                  >
                    <span className="font-semibold">Virtual</span>
                    <span className={cn("mt-1 block text-xs", useDarkChrome ? "text-zinc-400" : "text-slate-500")}>
                      Join online via Zoom
                    </span>
                  </button>
                </div>
                {form.formState.errors.mode ? (
                  <p className={errorClass}>{form.formState.errors.mode.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="sm:col-span-2">
              {showMarketingOptIn && (!twoStep || step === 2) ? (
                <div className="mb-3">
                  <MarketingOptInCheckbox
                    checked={marketingOptIn}
                    onChange={setMarketingOptIn}
                    label={marketingConsentLabel}
                    privacyPolicyUrl={event.org.marketingPrivacyPolicyUrl}
                    dark={useDarkChrome}
                  />
                </div>
              ) : null}
              {form.formState.errors.root ? (
                <p className={cn("mb-3 text-sm", errorClass)}>{form.formState.errors.root.message}</p>
              ) : null}
              {capacityFull ? (
                <div
                  className={cn(
                    "mb-3 space-y-2 rounded-lg border px-3 py-3",
                    useDarkChrome ? "border-indigo-500/30 bg-indigo-500/10" : "border-indigo-200 bg-indigo-50"
                  )}
                >
                  <p className={cn("text-sm font-medium", useDarkChrome ? "text-indigo-100" : "text-indigo-900")}>
                    Event is at capacity
                  </p>
                  <Button type="button" variant="secondary" className={lookupBtnClass} onClick={() => void joinWaitlist()}>
                    Join waitlist
                  </Button>
                </div>
              ) : null}
              <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Submitting…"
                  : twoStep && step === 1
                    ? "Continue"
                    : "Complete registration"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </form>
  );
}

