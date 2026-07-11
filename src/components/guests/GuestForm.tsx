"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AttendMode, EventType, Role, Tier } from "@prisma/client";
import { type ReactNode, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { addGuest, updateGuestDetails } from "@/lib/actions/guest.actions";
import type { GuestWithRep } from "@/lib/db/guests";
import { initialModeForOrganizerGuest } from "@/lib/guests/attendanceDefaults";
import {
  REFERRAL_SOURCE_OPTIONS,
  REGISTRATION_COUNTRY_OPTIONS
} from "@/lib/register/countryOptions";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";
import { isSalesRepRole } from "@/lib/rbac/types";
import { cn } from "@/lib/utils";

type FormMode = AttendMode | "";

function buildGuestFormSchema(eventType: EventType, emailRequired: boolean) {
  const modeSchema =
    eventType === EventType.HYBRID
      ? z.union([z.literal("" as const), z.nativeEnum(AttendMode)])
      : z.nativeEnum(AttendMode);

  return z
    .object({
      name: z.string().min(2),
      email: emailRequired
        ? z.string().email()
        : z.union([z.literal(""), z.string().email()]).optional(),
      phone: z.string().min(1, "Mobile phone is required"),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      country: z.string().max(32).optional(),
      accessibilityNotes: z.string().max(2000).optional(),
      referralSource: z.string().max(80).optional(),
      tier: z.nativeEnum(Tier),
      mode: modeSchema,
      dietary: z.string().optional(),
      repId: z.string().optional(),
      staffEmployeeId: z.string().max(120).optional(),
      department: z.string().max(120).optional(),
      branch: z.string().max(120).optional(),
      eventGuestGroupId: z.string().optional()
    })
    .superRefine((data, ctx) => {
      if (!isValidE164(data.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid international mobile number, for example +14155552671.",
          path: ["phone"]
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildGuestFormSchema>>;

type SalesRepOption = { id: string; name: string | null; email: string };

type EventGuestGroupLite = { id: string; name: string };

type GuestFormProps = {
  eventId: string;
  eventType: EventType;
  emailMandatoryForRegistration?: boolean;
  eventGuestGroups?: EventGuestGroupLite[];
  salesReps: SalesRepOption[];
  role: Role;
  currentUserId: string;
  /** When set, form updates this guest instead of creating one. */
  editingGuest?: GuestWithRep | null;
  onSuccess: (opts: { emailDelivered: boolean; invitationPendingUntilPublish?: boolean }) => void;
  onCancel: () => void;
};

const lbl = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-600";
const control =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

function defaultModeValue(eventType: EventType): FormMode {
  const m = initialModeForOrganizerGuest({ type: eventType, virtualCapacity: 0 });
  if (m == null) return "";
  return m;
}

function Section({
  kicker,
  title,
  description,
  children
}: {
  kicker: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{kicker}</p>
      <h4 className="mt-1 text-sm font-bold text-zinc-900">{title}</h4>
      {description ? <p className="mt-1 text-xs leading-relaxed text-zinc-600">{description}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function GuestForm({
  eventId,
  eventType,
  emailMandatoryForRegistration = true,
  eventGuestGroups = [],
  salesReps,
  role,
  currentUserId,
  editingGuest,
  onSuccess,
  onCancel
}: GuestFormProps) {
  const schema = useMemo(
    () => buildGuestFormSchema(eventType, emailMandatoryForRegistration),
    [eventType, emailMandatoryForRegistration]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      country: "",
      accessibilityNotes: "",
      referralSource: "",
      tier: Tier.C,
      mode: defaultModeValue(eventType),
      dietary: "",
      repId: isSalesRepRole(role) ? currentUserId : "",
      staffEmployeeId: "",
      department: "",
      branch: "",
      eventGuestGroupId: ""
    }
  });

  const mode = form.watch("mode");

  useEffect(() => {
    if (eventType === EventType.HYBRID) return;
    form.setValue("mode", eventType === EventType.VIRTUAL ? AttendMode.VIRTUAL : AttendMode.IN_PERSON);
  }, [eventType, form]);

  useEffect(() => {
    if (!editingGuest) return;
    const m = editingGuest.mode as AttendMode | null;
    const modeVal: FormMode =
      eventType === EventType.HYBRID ? (m == null ? "" : m) : (m ?? defaultModeValue(eventType));
    form.reset({
      name: editingGuest.name,
      email: editingGuest.email ?? "",
      phone: editingGuest.phone ?? "",
      company: editingGuest.company ?? "",
      jobTitle: editingGuest.jobTitle ?? "",
      country: editingGuest.country ?? "",
      accessibilityNotes: editingGuest.accessibilityNotes ?? "",
      referralSource: editingGuest.referralSource ?? "",
      tier: editingGuest.tier as Tier,
      mode: modeVal as FormValues["mode"],
      dietary: editingGuest.dietary ?? "",
      repId: editingGuest.repId ?? "",
      staffEmployeeId: editingGuest.staffEmployeeId ?? "",
      department: editingGuest.department ?? "",
      branch: editingGuest.branch ?? "",
      eventGuestGroupId: editingGuest.eventGuestGroupId ?? ""
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when opening a different guest
  }, [editingGuest?.id]);

  async function onSubmit(values: FormValues) {
    const repId = isSalesRepRole(role)
      ? currentUserId
      : values.repId?.trim()
        ? values.repId.trim()
        : undefined;

    const modeVal = values.mode as FormMode;
    const groupId = values.eventGuestGroupId?.trim() || null;

    if (editingGuest) {
      const res = await updateGuestDetails({
        guestId: editingGuest.id,
        eventId,
        name: values.name,
        email: values.email?.trim() || null,
        phone: values.phone.trim(),
        company: values.company || undefined,
        jobTitle: values.jobTitle || undefined,
        country: values.country?.trim() || undefined,
        accessibilityNotes: values.accessibilityNotes?.trim() || undefined,
        referralSource: values.referralSource?.trim() || undefined,
        staffEmployeeId: values.staffEmployeeId?.trim() || undefined,
        department: values.department?.trim() || undefined,
        branch: values.branch?.trim() || undefined,
        tier: values.tier,
        mode: modeVal === "" ? null : (modeVal as AttendMode),
        dietary: modeVal === AttendMode.IN_PERSON ? values.dietary?.trim() || undefined : undefined,
        repId: repId ?? null,
        eventGuestGroupId: groupId ?? null
      });
      if (!res.success || !res.data) {
        form.setError("root", { message: res.error ?? "Failed" });
        return;
      }
      onSuccess({ emailDelivered: false });
      return;
    }

    const res = await addGuest({
      eventId,
      name: values.name,
      email: values.email?.trim() || null,
      phone: values.phone.trim(),
      company: values.company || undefined,
      jobTitle: values.jobTitle || undefined,
      country: values.country?.trim() || undefined,
      accessibilityNotes: values.accessibilityNotes?.trim() || undefined,
      referralSource: values.referralSource?.trim() || undefined,
      staffEmployeeId: values.staffEmployeeId?.trim() || undefined,
      department: values.department?.trim() || undefined,
      branch: values.branch?.trim() || undefined,
      tier: values.tier,
      ...(modeVal === "" ? {} : { mode: modeVal as AttendMode }),
      dietary: modeVal === AttendMode.IN_PERSON ? values.dietary?.trim() || undefined : undefined,
      repId: repId ?? null,
      eventGuestGroupId: groupId
    });

    if (!res.success || !res.data) {
      form.setError("root", { message: res.error ?? "Failed" });
      return;
    }
    onSuccess({
      emailDelivered: res.data.emailDelivered,
      invitationPendingUntilPublish: res.data.invitationPendingUntilPublish
    });
  }

  const showModeSelect = eventType === EventType.HYBRID;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Section
        kicker="Step 1"
        title="Identity & contact"
        description="Used on badges, emails, and the guest record."
      >
        <div className="sm:col-span-2">
          <label className={lbl}>Full name</label>
          <Input className={control} {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>
            Work email
            {emailMandatoryForRegistration ? <span className="text-red-500"> *</span> : " (optional)"}
          </label>
          <Input className={control} type="email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Mobile phone (international format, e.g. +14155552671)</label>
          <Input
            className={control}
            placeholder="+233201234567"
            autoComplete="tel"
            {...form.register("phone")}
          />
          {form.formState.errors.phone ? (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.phone.message}</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">Include country code (required for SMS confirmations).</p>
          )}
        </div>
      </Section>

      <Section
        kicker="Step 2"
        title="Organization"
        description="Optional fields for CRM, reporting, and internal programs."
      >
        <div>
          <label className={lbl}>Company</label>
          <Input className={control} {...form.register("company")} />
        </div>
        <div>
          <label className={lbl}>Job title</label>
          <Input className={control} {...form.register("jobTitle")} />
        </div>
        <div>
          <label className={lbl}>Staff ID</label>
          <Input className={control} {...form.register("staffEmployeeId")} placeholder="Internal programs" />
        </div>
        <div>
          <label className={lbl}>Department</label>
          <Input className={control} {...form.register("department")} />
        </div>
        <div>
          <label className={lbl}>Branch</label>
          <Input className={control} {...form.register("branch")} placeholder="Meal menu routing" />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Country / region</label>
          <select {...form.register("country")} className={control}>
            {REGISTRATION_COUNTRY_OPTIONS.map((o) => (
              <option key={o.value || "unset"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Accessibility</label>
          <textarea
            {...form.register("accessibilityNotes")}
            rows={2}
            className={cn(control, "min-h-[4.5rem] resize-y")}
            placeholder="Mobility, hearing, vision, or other onsite needs"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Referral source</label>
          <select {...form.register("referralSource")} className={control}>
            {REFERRAL_SOURCE_OPTIONS.map((o) => (
              <option key={o.value || "unset"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section
        kicker="Step 3"
        title="Attendance & assignment"
        description="Hybrid events can leave attendance undecided until check-in or virtual join."
      >
        <div>
          <label className={lbl}>Tier</label>
          <select {...form.register("tier")} className={control}>
            <option value={Tier.A}>A</option>
            <option value={Tier.B}>B</option>
            <option value={Tier.C}>C</option>
          </select>
        </div>
        {showModeSelect ? (
          <div>
            <label className={lbl}>Attendance mode</label>
            <select {...form.register("mode")} className={control}>
              <option value="">Undecided (set at check-in or when joining online)</option>
              <option value={AttendMode.IN_PERSON}>In person</option>
              <option value={AttendMode.VIRTUAL}>Virtual</option>
            </select>
          </div>
        ) : (
          <div>
            <label className={lbl}>Attendance mode</label>
            <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900">
              {eventType === EventType.VIRTUAL ? "Virtual" : "In person"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Set by event format.</p>
          </div>
        )}
        {mode === AttendMode.IN_PERSON ? (
          <div className="sm:col-span-2">
            <label className={lbl}>Dietary</label>
            <Input className={control} placeholder="Allergies / preferences" {...form.register("dietary")} />
          </div>
        ) : null}
        {eventGuestGroups.length > 0 ? (
          <div className="sm:col-span-2">
            <label className={lbl}>Guest group</label>
            <select {...form.register("eventGuestGroupId")} className={control}>
              <option value="">— None —</option>
              {eventGuestGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {(role === "ADMIN" || role === "MARKETING") && salesReps.length > 0 ? (
          <div className="sm:col-span-2">
            <label className={lbl}>Assigned rep</label>
            <select {...form.register("repId")} className={control}>
              <option value="">— Unassigned —</option>
              {salesReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.name ?? r.email) + ` (${r.email})`}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {isSalesRepRole(role) ? (
          <p className="sm:col-span-2 text-xs text-zinc-600">You will be assigned as the rep for this guest.</p>
        ) : null}
      </Section>

      {form.formState.errors.root ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {form.formState.errors.root.message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end sm:gap-3">
        <Button type="button" variant="secondary" className="w-full border-zinc-200 sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full bg-zinc-900 font-semibold text-white hover:bg-zinc-800 sm:w-auto"
        >
          {form.formState.isSubmitting ? "Saving…" : editingGuest ? "Save changes" : "Add guest"}
        </Button>
      </div>
    </form>
  );
}
