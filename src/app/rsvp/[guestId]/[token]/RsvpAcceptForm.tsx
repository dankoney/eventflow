"use client";

import { AttendMode, EventBlueprintTemplate } from "@prisma/client";
import { Pencil } from "lucide-react";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { submitRsvpAccept } from "@/lib/actions/rsvp.actions";
import { formatMarketingConsentLabel } from "@/lib/email/marketingOptIn";

import { MarketingOptInCheckbox } from "@/components/register/MarketingOptInCheckbox";

import { rsvpAcceptSuccessCopy } from "./rsvpPageCopy";

type Prefill = {
  name: string;
  email: string;
  phone: string;
  company: string | null;
  jobTitle: string | null;
  mode: AttendMode | null;
  accommodationRequested: boolean;
  accommodationDetails: string | null;
};

type Props = {
  guestId: string;
  token: string;
  accent: string;
  prefill: Prefill;
  allowsInPerson: boolean;
  allowsVirtual: boolean;
  blueprintTemplate: EventBlueprintTemplate;
  /** When true, an in-person confirm is treated as an instant check-in (LIVE event). */
  eventIsLive: boolean;
  accommodationTravelNotes: string | null;
  alreadyConfirmed: boolean;
  showMarketingOptIn?: boolean;
  marketingConsentLabel?: string;
  marketingPrivacyPolicyUrl?: string | null;
};

export function RsvpAcceptForm({
  guestId,
  token,
  accent,
  prefill,
  allowsInPerson,
  allowsVirtual,
  blueprintTemplate,
  eventIsLive,
  accommodationTravelNotes,
  alreadyConfirmed,
  showMarketingOptIn = false,
  marketingConsentLabel = "",
  marketingPrivacyPolicyUrl = null
}: Props) {
  const isConference = blueprintTemplate === EventBlueprintTemplate.CONFERENCE;
  const isInternalStaff = blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF;
  const defaultMode: AttendMode =
    prefill.mode ?? (allowsInPerson && !allowsVirtual
      ? AttendMode.IN_PERSON
      : !allowsInPerson && allowsVirtual
        ? AttendMode.VIRTUAL
        : AttendMode.IN_PERSON);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [company, setCompany] = useState(prefill.company ?? "");
  const [jobTitle, setJobTitle] = useState(prefill.jobTitle ?? "");
  const [mode, setMode] = useState<AttendMode>(defaultMode);
  const [needsAccommodation, setNeedsAccommodation] = useState<boolean>(prefill.accommodationRequested);
  const [accommodationDetails, setAccommodationDetails] = useState<string>(prefill.accommodationDetails ?? "");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    mode: AttendMode;
    emailDelivered: boolean;
    checkedInNow: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!allowsInPerson && allowsVirtual) setMode(AttendMode.VIRTUAL);
    if (allowsInPerson && !allowsVirtual) setMode(AttendMode.IN_PERSON);
  }, [allowsInPerson, allowsVirtual]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!/^\+\d{8,16}$/.test(phone.trim())) {
      setError("Enter phone in international format, e.g. +233501234567.");
      return;
    }

    startTransition(async () => {
      const res = await submitRsvpAccept({
        guestId,
        token,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim() || null,
        jobTitle: jobTitle.trim() || null,
        mode,
        accommodationRequested: mode === AttendMode.IN_PERSON && isConference ? needsAccommodation : false,
        accommodationDetails:
          mode === AttendMode.IN_PERSON && isConference && needsAccommodation
            ? accommodationDetails.trim() || null
            : null,
        marketingOptIn: showMarketingOptIn ? marketingOptIn : false
      });
      if (!res.success) {
        setError(res.error ?? "Could not save your RSVP. Please try again.");
        return;
      }
      setSuccess({
        mode: res.data?.mode ?? mode,
        emailDelivered: res.data?.emailDelivered ?? false,
        checkedInNow: res.data?.checkedInNow ?? false
      });
    });
  }

  if (success) {
    const copy = rsvpAcceptSuccessCopy({
      blueprint: blueprintTemplate,
      checkedInNow: success.checkedInNow,
      emailDelivered: success.emailDelivered
    });
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ background: accent }}
        >
          ✓
        </div>
        <h2 className="mt-4 font-[Manrope,Inter,system-ui] text-xl font-bold text-zinc-900">{copy.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{copy.body}</p>
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-500 underline-offset-4 hover:underline"
        >
          Update my RSVP
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700">Your details</h2>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
            aria-label={editing ? "Lock fields" : "Edit fields"}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? "Done" : "Edit"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReadOrEditField
            label="Full name"
            value={name}
            onChange={setName}
            editing={editing}
            autoComplete="name"
            colSpan
          />
          <ReadOrEditField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            editing={editing}
            autoComplete="email"
            colSpan
          />
          <ReadOrEditField
            label="Mobile phone"
            type="tel"
            value={phone}
            onChange={setPhone}
            editing={editing}
            autoComplete="tel"
            placeholder="+233501234567"
            help="International format, e.g. +233501234567"
            colSpan
          />
          <ReadOrEditField
            label="Company"
            value={company}
            onChange={setCompany}
            editing={editing}
            autoComplete="organization"
            placeholder="Where do you work?"
            colSpan
          />
          <ReadOrEditField
            label="Job title"
            value={jobTitle}
            onChange={setJobTitle}
            editing={editing}
            autoComplete="organization-title"
            placeholder="Your role"
            colSpan
          />
        </div>
      </section>

      {(allowsInPerson && allowsVirtual) || allowsInPerson || allowsVirtual ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700">How will you join?</h2>
          {allowsInPerson && allowsVirtual ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { value: AttendMode.IN_PERSON, label: "In person", hint: "Join us at the venue" },
                { value: AttendMode.VIRTUAL, label: "Virtual", hint: "Stream live from anywhere" }
              ].map((opt) => {
                const checked = mode === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      checked
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={opt.value}
                      checked={checked}
                      onChange={() => setMode(opt.value)}
                      className="mt-0.5 h-4 w-4 accent-zinc-900"
                    />
                    <span>
                      <span className="block font-semibold">{opt.label}</span>
                      <span className={`block text-xs ${checked ? "text-zinc-300" : "text-zinc-500"}`}>
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              {allowsInPerson ? "This event is in-person only." : "This event is virtual only."}
            </p>
          )}
        </section>
      ) : null}

      {isConference && mode === AttendMode.IN_PERSON ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700">
            Accommodation
          </h2>
          {accommodationTravelNotes?.trim() ? (
            <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              {accommodationTravelNotes.trim()}
            </p>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { value: false, label: "I have my own arrangements", hint: "No hotel needed" },
              { value: true, label: "I need accommodation", hint: "Share my preferences below" }
            ].map((opt) => {
              const checked = needsAccommodation === opt.value;
              return (
                <label
                  key={String(opt.value)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    checked
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="accommodation"
                    checked={checked}
                    onChange={() => setNeedsAccommodation(opt.value)}
                    className="mt-0.5 h-4 w-4 accent-zinc-900"
                  />
                  <span>
                    <span className="block font-semibold">{opt.label}</span>
                    <span className={`block text-xs ${checked ? "text-zinc-300" : "text-zinc-500"}`}>
                      {opt.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {needsAccommodation ? (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Preferences (check-in / check-out, room type, dietary)
              </span>
              <textarea
                value={accommodationDetails}
                onChange={(e) => setAccommodationDetails(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                placeholder="e.g. Check in Nov 13, check out Nov 15. King bed. Vegetarian breakfast."
              />
            </label>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {showMarketingOptIn ? (
        <MarketingOptInCheckbox
          checked={marketingOptIn}
          onChange={setMarketingOptIn}
          label={marketingConsentLabel}
          privacyPolicyUrl={marketingPrivacyPolicyUrl}
        />
      ) : null}

      <button
        type="submit"
        disabled={pending}
        style={{ background: accent, color: pickContrastTextColor(accent) }}
        className="w-full rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wider transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? eventIsLive && mode === AttendMode.IN_PERSON
            ? "Checking you in…"
            : "Confirming…"
          : eventIsLive && mode === AttendMode.IN_PERSON
            ? "Confirm my presence"
            : alreadyConfirmed
              ? "Update RSVP"
              : isInternalStaff
                ? "Confirm my registration"
                : "Confirm RSVP"}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  help?: string;
  colSpan?: boolean;
};

function ReadOrEditField({
  label,
  value,
  onChange,
  editing,
  type = "text",
  autoComplete,
  placeholder,
  help,
  colSpan
}: FieldProps) {
  return (
    <div className={colSpan ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none ring-zinc-300 transition focus:ring-2"
        />
      ) : (
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
          {value?.trim() ? value : <span className="text-zinc-400">Not set</span>}
        </div>
      )}
      {help ? <p className="mt-1 text-[11px] text-zinc-500">{help}</p> : null}
    </div>
  );
}

function pickContrastTextColor(hex: string): string {
  const t = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}
