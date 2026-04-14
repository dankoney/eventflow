"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AttendMode, EventType, Tier } from "@prisma/client";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { publicRegisterGuest } from "@/lib/actions/guest.actions";
import type { PublicRegistrationEvent } from "@/lib/db/events";

function buildSchema(allowsInPerson: boolean, allowsVirtual: boolean) {
  return z
    .object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      tier: z.nativeEnum(Tier),
      mode: z.nativeEnum(AttendMode),
      dietary: z.string().optional()
    })
    .superRefine((data, ctx) => {
      if (allowsInPerson && allowsVirtual) return;
      if (allowsInPerson && !allowsVirtual && data.mode !== AttendMode.IN_PERSON) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "In-person only for this event.",
          path: ["mode"]
        });
      }
      if (allowsVirtual && !allowsInPerson && data.mode !== AttendMode.VIRTUAL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Virtual only for this event.",
          path: ["mode"]
        });
      }
    });
}

type PublicRegistrationFormProps = {
  event: PublicRegistrationEvent;
};

export function PublicRegistrationForm({ event }: PublicRegistrationFormProps) {
  const [done, setDone] = useState(false);
  const [registeredMode, setRegisteredMode] = useState<AttendMode | null>(null);
  const allowsInPerson =
    event.type === EventType.IN_PERSON || event.type === EventType.HYBRID;
  const allowsVirtual =
    (event.type === EventType.VIRTUAL || event.type === EventType.HYBRID) &&
    event.virtualCapacity > 0 &&
    !!event.zoomMeetingId;

  const defaultMode = allowsVirtual && !allowsInPerson ? AttendMode.VIRTUAL : AttendMode.IN_PERSON;

  const schema = useMemo(
    () => buildSchema(allowsInPerson, allowsVirtual),
    [allowsInPerson, allowsVirtual]
  );
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      tier: Tier.C,
      mode: defaultMode,
      dietary: ""
    }
  });

  const mode = form.watch("mode");

  async function onSubmit(values: FormValues) {
    const res = await publicRegisterGuest({
      eventId: event.id,
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      company: values.company || undefined,
      jobTitle: values.jobTitle || undefined,
      tier: values.tier,
      mode: values.mode,
      dietary: mode === AttendMode.IN_PERSON ? values.dietary?.trim() || undefined : undefined
    });

    if (!res.success) {
      form.setError("root", { message: res.error ?? "Registration failed" });
      return;
    }
    setRegisteredMode(values.mode);
    setDone(true);
  }

  if (done && registeredMode) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5 text-emerald-900">
        <p className="font-semibold">You are registered.</p>
        <p className="mt-2 text-sm text-emerald-800">
          Check your email for confirmation
          {registeredMode === AttendMode.IN_PERSON ? " and your entry QR code." : " and join details."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
          <Input {...form.register("name")} autoComplete="name" />
          {form.formState.errors.name ? (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
          <Input type="email" {...form.register("email")} autoComplete="email" />
          {form.formState.errors.email ? (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
          <Input type="tel" {...form.register("phone")} autoComplete="tel" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
          <Input {...form.register("company")} autoComplete="organization" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Job title</label>
          <Input {...form.register("jobTitle")} autoComplete="organization-title" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tier</label>
          <select
            {...form.register("tier")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value={Tier.A}>A</option>
            <option value={Tier.B}>B</option>
            <option value={Tier.C}>C</option>
          </select>
        </div>
        {allowsInPerson && allowsVirtual ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Attendance</label>
            <select
              {...form.register("mode")}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value={AttendMode.IN_PERSON}>In person</option>
              <option value={AttendMode.VIRTUAL}>Virtual</option>
            </select>
          </div>
        ) : null}
        {mode === AttendMode.IN_PERSON && allowsInPerson ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Dietary</label>
            <Input placeholder="Allergies / preferences" {...form.register("dietary")} />
          </div>
        ) : null}
      </div>

      {form.formState.errors.root ? (
        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Submitting…" : "Register"}
      </Button>
    </form>
  );
}
