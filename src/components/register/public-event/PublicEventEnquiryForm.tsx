"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { submitPublicEventEnquiry } from "@/lib/actions/publicEventEnquiry.actions";
import {
  NIGHT_EDITION_ENQUIRY_FORM_SHELL,
  TECH_NEXUS_ENQUIRY_FORM_SHELL
} from "@/lib/public-event/registerFormShell";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().email("Enter a valid email."),
  message: z.string().trim().min(10, "Please write at least a few sentences.").max(4000)
});

type FormValues = z.infer<typeof schema>;

type PublicEventEnquiryFormProps = {
  eventId: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Dark surface variant — used inside the dark public event experience. */
  dark?: boolean;
  /** Night Edition / TechNexus — matches registration form tokens and layout. */
  variant?: "default" | "night-edition" | "technexus";
};

export function PublicEventEnquiryForm({
  eventId,
  disabled,
  disabledReason,
  dark = false,
  variant = "default"
}: PublicEventEnquiryFormProps) {
  const isTechnexus = variant === "technexus";
  const isNight = variant === "night-edition" || dark || isTechnexus;
  const [sent, setSent] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", message: "" }
  });

  async function onSubmit(values: FormValues) {
    const res = await submitPublicEventEnquiry({
      eventId,
      name: values.name,
      email: values.email,
      message: values.message
    });
    if (!res.success) {
      form.setError("root", { message: res.error ?? "Could not send." });
      return;
    }
    setSent(true);
  }

  const labelClass = cn(
    "mb-1.5 block text-xs font-semibold uppercase tracking-wider",
    isNight ? "text-[var(--pe-on-surface-variant)]" : "text-on-surface-variant"
  );
  const inputClass = cn(
    "w-full rounded-lg px-4 py-3 text-base outline-none transition",
    isNight
      ? cn(
          "border border-white/10 bg-[var(--pe-surface-container-high)] text-[var(--pe-on-surface)] placeholder:text-[var(--pe-on-surface-variant)]/60",
          isTechnexus
            ? "focus:border-[color:var(--pe-tertiary-container)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--pe-tertiary-container)_35%,transparent)]"
            : "focus:border-[color:var(--pe-primary)]/50 focus:ring-2 focus:ring-[color:var(--pe-primary)]/20"
        )
      : "border-transparent bg-surface-container text-zinc-900 focus:border-[color:var(--accent,#00677e)]"
  );
  const errorClass = cn("mt-1 text-xs", isNight ? "text-red-400" : "text-red-600");
  const noticeClass = (tone: "warn" | "ok" | "err") =>
    cn(
      "rounded-xl border p-5 text-sm",
      tone === "warn" &&
        (isNight ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-amber-200 bg-amber-50/80 text-amber-950"),
      tone === "ok" &&
        (isNight ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-900"),
      tone === "err" &&
        (isNight ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-800")
    );
  const submitClass = cn(
    "w-full rounded-full py-3.5 text-sm font-bold uppercase tracking-wide transition disabled:opacity-60",
    isTechnexus
      ? "bg-[var(--pe-cta-bg,var(--pe-tertiary-container))] text-[var(--pe-cta-fg,var(--pe-on-tertiary-container,#fff))] shadow-[0_12px_32px_-8px_color-mix(in_srgb,var(--pe-cta-bg,var(--pe-tertiary-container))_55%,transparent)] hover:brightness-95"
      : isNight
        ? "bg-[linear-gradient(135deg,var(--pe-gradient-from),var(--pe-gradient-to))] text-[var(--pe-background)] shadow-[0_0_24px_rgba(255,169,249,0.25)] hover:opacity-90"
        : "rounded-lg bg-zinc-950 text-white hover:opacity-90"
  );

  if (disabled) {
    return <div className={noticeClass("warn")}>{disabledReason ?? "Enquiries are not available until a contact email is published for this event."}</div>;
  }

  if (sent) {
    return (
      <div className={noticeClass("ok")}>
        <p className="font-semibold">Message sent.</p>
        <p className={cn("mt-2", isNight ? "text-emerald-200/90" : "text-emerald-800")}>
          The organizer will reply to the email address you provided.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
      className={cn(
        isTechnexus && TECH_NEXUS_ENQUIRY_FORM_SHELL,
        isNight && !isTechnexus && NIGHT_EDITION_ENQUIRY_FORM_SHELL,
        "space-y-5"
      )}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="enquiry-name">
            Your name
          </label>
          <input
            id="enquiry-name"
            {...form.register("name")}
            autoComplete="name"
            className={inputClass}
          />
          {form.formState.errors.name ? <p className={errorClass}>{form.formState.errors.name.message}</p> : null}
        </div>
        <div>
          <label className={labelClass} htmlFor="enquiry-email">
            Your email
          </label>
          <input
            id="enquiry-email"
            type="email"
            {...form.register("email")}
            autoComplete="email"
            className={inputClass}
          />
          {form.formState.errors.email ? <p className={errorClass}>{form.formState.errors.email.message}</p> : null}
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="enquiry-message">
          Message
        </label>
        <textarea
          id="enquiry-message"
          {...form.register("message")}
          rows={5}
          className={inputClass}
          placeholder="Ask about logistics, accessibility, or group registration…"
        />
        {form.formState.errors.message ? <p className={errorClass}>{form.formState.errors.message.message}</p> : null}
      </div>
      {form.formState.errors.root ? <p className={noticeClass("err")}>{form.formState.errors.root.message}</p> : null}
      <button type="submit" disabled={form.formState.isSubmitting} className={submitClass}>
        {form.formState.isSubmitting ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
