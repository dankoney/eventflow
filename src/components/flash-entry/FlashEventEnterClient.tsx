"use client";

import { EventBlueprintTemplate } from "@prisma/client";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { confirmRsvpPresence } from "@/lib/actions/rsvp.actions";
import { flashEntryCreateWalkIn, flashEntryResolveEmail } from "@/lib/actions/flashEntry.actions";

type PresenceConfirmState = {
  guestId: string;
  token: string;
  firstName: string;
  alreadyCheckedIn: boolean;
  rsvpUrl: string;
};

type FlashEventEnterClientProps = {
  orgSlug: string;
  eventId: string;
  eventName: string;
  blueprintTemplate: EventBlueprintTemplate;
  allowFlashEntry: boolean;
};

export function FlashEventEnterClient({
  orgSlug,
  eventId,
  eventName,
  blueprintTemplate,
  allowFlashEntry
}: FlashEventEnterClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "walkin" | "presence">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceConfirmState | null>(null);

  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkCompany, setWalkCompany] = useState("");
  const [walkJobTitle, setWalkJobTitle] = useState("");
  const [walkStaffId, setWalkStaffId] = useState("");
  const [walkDepartment, setWalkDepartment] = useState("");

  const showStaffFields = blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF;

  async function onContinueEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setRejectMessage(null);
    setBusy(true);
    const res = await flashEntryResolveEmail({ orgSlug, eventId, email });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (res.data.kind === "rsvp") {
      router.push(res.data.rsvpUrl);
      return;
    }
    if (res.data.kind === "presence_confirm") {
      setPresence({
        guestId: res.data.guestId,
        token: res.data.token,
        firstName: res.data.firstName,
        alreadyCheckedIn: res.data.alreadyCheckedIn,
        rsvpUrl: res.data.rsvpUrl
      });
      setPhase("presence");
      return;
    }
    if (res.data.kind === "rejected") {
      setRejectMessage(res.data.message);
      return;
    }
    setPhase("walkin");
    setWalkName("");
    setWalkPhone("");
  }

  async function onConfirmPresence() {
    if (!presence) return;
    setError(null);
    setBusy(true);
    const res = await confirmRsvpPresence({ guestId: presence.guestId, token: presence.token });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not record your presence. Please try again.");
      return;
    }
    setPresence({ ...presence, alreadyCheckedIn: true });
  }

  async function onWalkInSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await flashEntryCreateWalkIn({
      orgSlug,
      eventId,
      email,
      name: walkName,
      phone: walkPhone,
      company: walkCompany || undefined,
      jobTitle: walkJobTitle || undefined,
      staffEmployeeId: walkStaffId || undefined,
      department: walkDepartment || undefined
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not create walk-in.");
      return;
    }
    router.push(res.data.rsvpUrl);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href={`/o/${encodeURIComponent(orgSlug)}`}
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          ← Back to Command Center
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Join this event</h1>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">{eventName}</span> — enter the work email your organizer has on
          file. We&apos;ll take you to RSVP (in-person or virtual).
        </p>
      </div>

      {phase === "presence" && presence ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          {presence.alreadyCheckedIn ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  You&apos;re checked in, {presence.firstName}.
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Welcome to {eventName}. Your presence is on the books — staff don&apos;t need to scan you.
                </p>
              </div>
              <Link
                href={presence.rsvpUrl}
                className="inline-block text-xs font-semibold uppercase tracking-wider text-slate-500 underline-offset-4 hover:underline"
              >
                Open my RSVP page
              </Link>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Live now</p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Hi {presence.firstName}, ready to check you in.
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                We found you on the guest list. Tap below to self check-in for{" "}
                <span className="font-medium text-slate-800">{eventName}</span> — no QR scan needed.
              </p>
              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}
              <Button
                type="button"
                disabled={busy}
                onClick={() => void onConfirmPresence()}
                className="w-full"
              >
                {busy ? "Confirming…" : "Confirm my presence"}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setPresence(null);
                    setPhase("email");
                  }}
                  className="underline-offset-4 hover:underline"
                >
                  ← Use a different email
                </button>
                <Link href={presence.rsvpUrl} className="font-medium text-slate-700 underline-offset-4 hover:underline">
                  Open my RSVP page
                </Link>
              </div>
            </>
          )}
        </div>
      ) : phase === "email" ? (
        <form onSubmit={(ev) => void onContinueEmail(ev)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">Work email</label>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@company.com"
              className="w-full"
            />
          </div>
          {rejectMessage ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{rejectMessage}</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Checking…" : "Continue"}
          </Button>
          {allowFlashEntry ? (
            <p className="text-xs text-slate-500">
              If you are not in the CRM yet, Continue will ask for a few details to register you as a walk-in (when
              allowed for this event).
            </p>
          ) : (
            <p className="text-xs text-slate-500">Walk-ins are turned off — your email must match the guest list or CRM.</p>
          )}
        </form>
      ) : (
        <form onSubmit={(ev) => void onWalkInSubmit(ev)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            No matching guest or contact for <span className="font-mono font-medium">{email}</span>. Complete your
            details to continue as a walk-in.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">Full name</label>
            <Input value={walkName} onChange={(ev) => setWalkName(ev.target.value)} required minLength={2} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">Mobile (E.164)</label>
            <Input
              type="tel"
              value={walkPhone}
              onChange={(ev) => setWalkPhone(ev.target.value)}
              required
              placeholder="+233501234567"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-800">Company (optional)</label>
              <Input value={walkCompany} onChange={(ev) => setWalkCompany(ev.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-800">Job title (optional)</label>
              <Input value={walkJobTitle} onChange={(ev) => setWalkJobTitle(ev.target.value)} />
            </div>
          </div>
          {showStaffFields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-800">Staff ID</label>
                <Input value={walkStaffId} onChange={(ev) => setWalkStaffId(ev.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-800">Department</label>
                <Input value={walkDepartment} onChange={(ev) => setWalkDepartment(ev.target.value)} required />
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setPhase("email")}>
              Back
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create walk-in & continue"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
