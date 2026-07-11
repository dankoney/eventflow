"use client";

import { InternalStaffCheckInMode, InternalStaffMealMenuScope } from "@prisma/client";
import { useState } from "react";
import { Video } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  checkInGuestPublicInternalStaff,
  lookupInternalStaffGuestMealMenu
} from "@/lib/actions/checkin.actions";
import { cn } from "@/lib/utils";

type InternalStaffRegisterPanelProps = {
  eventId: string;
  checkInMode: InternalStaffCheckInMode;
  /** Used for placeholder (e.g. you@company.com); first event allowlist domain or org default. */
  workEmailDomain: string | null;
  isDark: boolean;
  hasBrandColor: boolean;
  zoomJoinUrl: string | null;
  virtualCapacity: number;
  /** When true, show meal radios and require a choice before check-in. */
  mealSelectionAtCheckIn: boolean;
  mealMenuScope: InternalStaffMealMenuScope;
  /** Options when scope is ALL_STAFF (ignored for BY_BRANCH until after lookup). */
  mealMenuItems: string[];
};

export function InternalStaffRegisterPanel({
  eventId,
  checkInMode,
  workEmailDomain,
  isDark,
  hasBrandColor,
  zoomJoinUrl,
  virtualCapacity,
  mealSelectionAtCheckIn,
  mealMenuScope,
  mealMenuItems
}: InternalStaffRegisterPanelProps) {
  const needsLookupFirst =
    mealSelectionAtCheckIn && mealMenuScope === InternalStaffMealMenuScope.BY_BRANCH;

  const [credential, setCredential] = useState("");
  const [mealChoice, setMealChoice] = useState("");
  const [phase, setPhase] = useState<"credential" | "meal">(needsLookupFirst ? "credential" : "meal");
  const [resolvedMealItems, setResolvedMealItems] = useState<string[]>(() =>
    needsLookupFirst ? [] : mealMenuItems
  );
  const [guestPreviewName, setGuestPreviewName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    name: string;
    displayNameHint: string;
    alreadyCheckedIn: boolean;
  } | null>(null);

  const showPersonalLinkNote = checkInMode === InternalStaffCheckInMode.PERSONAL_LINK;

  const credentialPlaceholder = workEmailDomain
    ? `you@${workEmailDomain}`
    : "Your work email on file";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const v = credential.trim();
    if (!v) {
      setError("Enter your work email.");
      return;
    }

    if (needsLookupFirst && phase === "credential") {
      setBusy(true);
      const lookupRes = await lookupInternalStaffGuestMealMenu({ eventId, credential: v });
      setBusy(false);
      if (!lookupRes.success || !lookupRes.data) {
        setError(lookupRes.error ?? "Could not load meal options.");
        return;
      }
      setResolvedMealItems(lookupRes.data.mealMenuItems);
      setGuestPreviewName(lookupRes.data.guestName);
      setMealChoice("");
      setPhase("meal");
      return;
    }

    if (mealSelectionAtCheckIn && !mealChoice.trim()) {
      setError("Choose a meal option.");
      return;
    }
    setBusy(true);
    const res = await checkInGuestPublicInternalStaff({
      eventId,
      credential: v,
      ...(mealSelectionAtCheckIn ? { mealChoice: mealChoice.trim() } : {})
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not check in.");
      return;
    }
    setDone({
      name: res.data.guest.name,
      displayNameHint: res.data.displayNameHint,
      alreadyCheckedIn: res.data.alreadyCheckedIn
    });
  }

  const showZoom = virtualCapacity > 0 && Boolean(zoomJoinUrl);

  return (
    <div className="space-y-5">
      {showPersonalLinkNote ? (
        <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-200" : "text-slate-700")}>
          Prefer your <strong>personal Zoom link</strong> from email or WhatsApp when you have it—it is unique to
          you. If you did not receive a link, you can still use the same work email your organizer has on
          file below.
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {needsLookupFirst && phase === "meal" ? (
          <div>
            <p className={cn("text-sm", isDark ? "text-slate-300" : "text-slate-700")}>
              Signed in as <span className="font-medium">{guestPreviewName ?? "—"}</span>. Your meal list is based on
              your branch on file.
            </p>
            <p className={cn("mt-3 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
              Staff ID / email (locked for this check-in)
            </p>
            <Input className="mt-1 opacity-80" value={credential} readOnly disabled />
          </div>
        ) : (
          <div>
            <label className={cn("block text-sm font-medium", isDark ? "text-slate-200" : "text-slate-800")}>
              Check in with your work email
            </label>
            <p className={cn("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
              Use the same work email your organizer has on file.
            </p>
            <Input
              className="mt-2"
              placeholder={credentialPlaceholder}
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              autoComplete="username"
            />
          </div>
        )}

        {mealSelectionAtCheckIn && phase === "meal" ? (
          <fieldset className="space-y-2">
            <legend className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-800")}>
              Meal selection
            </legend>
            <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
              Pick one option for this session.
            </p>
            <div className="mt-2 space-y-2">
              {resolvedMealItems.map((opt) => (
                <label
                  key={opt}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    isDark ? "border-slate-600 bg-slate-900/60" : "border-slate-200 bg-white"
                  )}
                >
                  <input
                    type="radio"
                    name="meal"
                    value={opt}
                    checked={mealChoice === opt}
                    onChange={() => setMealChoice(opt)}
                  />
                  <span className={cn(isDark ? "text-slate-200" : undefined)}>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {error ? (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              isDark ? "border-red-500/35 bg-red-950/45 text-red-100" : "border-red-200 bg-red-50 text-red-900"
            )}
            role="alert"
          >
            <p className="font-semibold">Check-in failed</p>
            <p className="mt-1 leading-relaxed">{error}</p>
          </div>
        ) : null}
        {done ? (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              isDark
                ? "border-[color:var(--pe-accent)]/35 bg-[color:var(--pe-accent)]/10 text-slate-100"
                : "border-[color:var(--pe-accent)]/25 bg-[color:var(--pe-accent)]/5 text-slate-900"
            )}
          >
            <p className="font-semibold">You have successfully been checked in — {done.name}</p>
            <p className="mt-2">
              <span className="font-medium">Zoom display name:</span> {done.displayNameHint}
            </p>
            {showZoom && zoomJoinUrl ? (
              <p className="mt-3">
                <a
                  href={zoomJoinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center rounded-md underline underline-offset-2",
                    "font-medium hover:opacity-90",
                    hasBrandColor ? "text-[color:var(--pe-accent)]" : "text-sky-700 hover:text-sky-900"
                  )}
                >
                  <Video className="mr-2 h-4 w-4" aria-hidden />
                  Open Zoom join link
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {!done ? (
          <div className="flex flex-wrap gap-2">
            {needsLookupFirst && phase === "meal" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setPhase("credential");
                  setError(null);
                  setResolvedMealItems([]);
                  setGuestPreviewName(null);
                  setMealChoice("");
                }}
              >
                Back
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={busy}
              className="bg-[color:var(--pe-accent)] text-[color:var(--pe-accent-fg)] hover:opacity-90 disabled:opacity-60"
            >
              {busy
                ? needsLookupFirst && phase === "credential"
                  ? "Loading…"
                  : "Checking…"
                : needsLookupFirst && phase === "credential"
                  ? "Continue"
                  : "Check in"}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
