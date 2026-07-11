"use client";

import { EventType, InternalStaffMealMenuScope } from "@prisma/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CalendarClock, Loader2, Video } from "lucide-react";

import {
  checkInGuestByInternalMagicToken,
  getInternalStaffMagicCheckInMealMenu,
  type PublicInternalStaffCheckInData
} from "@/lib/actions/checkin.actions";
import type { DefaultEventBrandColors } from "@/lib/email/defaultEventBranding";
import { cn } from "@/lib/utils";

type InternalStaffMagicCheckInClientProps = {
  eventId: string;
  token: string;
  eventType: EventType;
  isDark: boolean;
  brandColors: DefaultEventBrandColors;
  zoomJoinUrl: string | null;
  virtualCapacity: number;
  mealSelectionAtCheckIn: boolean;
  mealMenuScope: InternalStaffMealMenuScope;
  mealMenuItems: string[];
};

function contrastingText(hex: string): string {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return "#ffffff";
  const h = match[1];
  const expanded = h.length === 3 ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : h;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 185 ? "#0f172a" : "#ffffff";
}

function isCheckInWindowMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("check-in opens") || lower.includes("booth has closed") || lower.includes("only available");
}

function CheckInWindowNotice({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-5",
        isDark
          ? "border-amber-500/35 bg-amber-950/25 text-amber-50"
          : "border-amber-200 bg-amber-50 text-amber-950"
      )}
    >
      <div className="flex items-start gap-3">
        <CalendarClock
          className={cn("mt-0.5 h-6 w-6 shrink-0", isDark ? "text-amber-300" : "text-amber-700")}
          aria-hidden
        />
        <div>
          <p className="text-base font-semibold leading-snug">Check-in is not open yet</p>
          <p className={cn("mt-2 text-sm leading-relaxed", isDark ? "text-amber-100/90" : "text-amber-900/80")}>
            {message}
          </p>
          <p className={cn("mt-3 text-xs leading-relaxed", isDark ? "text-amber-200/70" : "text-amber-800/70")}>
            Save this link and return when check-in opens. You can still read the programme details above.
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandedButton({
  children,
  className,
  variant = "primary",
  primaryColor = "var(--brand-primary)",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  primaryColor?: string;
}) {
  const primaryText = contrastingText(
    primaryColor.startsWith("var(") ? "#00677e" : primaryColor
  );
  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        isPrimary ? "shadow-md hover:opacity-95" : "ring-1 hover:opacity-90",
        className
      )}
      style={
        isPrimary
          ? { backgroundColor: "var(--brand-primary)", color: primaryText }
          : {
              backgroundColor: "transparent",
              color: "var(--brand-primary)",
              borderColor: "color-mix(in srgb, var(--brand-primary) 35%, transparent)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--brand-primary) 35%, transparent)"
            }
      }
      {...props}
    >
      {children}
    </button>
  );
}

function BrandedLink({
  href,
  children,
  variant = "secondary",
  primaryColor = "var(--brand-primary)"
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  primaryColor?: string;
}) {
  const primaryText = contrastingText(
    primaryColor.startsWith("var(") ? "#00677e" : primaryColor
  );
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90",
        isPrimary ? "shadow-md" : "ring-1"
      )}
      style={
        isPrimary
          ? { backgroundColor: "var(--brand-primary)", color: primaryText }
          : {
              color: "var(--brand-primary)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--brand-primary) 35%, transparent)"
            }
      }
    >
      {children}
    </Link>
  );
}

export function InternalStaffMagicCheckInClient({
  eventId,
  token,
  eventType,
  isDark,
  brandColors,
  zoomJoinUrl,
  virtualCapacity,
  mealSelectionAtCheckIn,
  mealMenuScope,
  mealMenuItems
}: InternalStaffMagicCheckInClientProps) {
  const instantFlow = !mealSelectionAtCheckIn;
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PublicInternalStaffCheckInData | null>(null);
  const [mealPhase, setMealPhase] = useState(false);
  const [resolvedMeals, setResolvedMeals] = useState<string[]>([]);
  const [guestPreviewName, setGuestPreviewName] = useState<string | null>(null);
  const [mealChoice, setMealChoice] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!instantFlow) {
      void (async () => {
        if (mealMenuScope === InternalStaffMealMenuScope.ALL_STAFF) {
          if (cancelled) return;
          setResolvedMeals(mealMenuItems);
          setMealPhase(true);
          setBusy(false);
          return;
        }
        const res = await getInternalStaffMagicCheckInMealMenu({ eventId, token });
        if (cancelled) return;
        setBusy(false);
        if (!res.success || !res.data) {
          setError(res.error ?? "Could not load meal options.");
          return;
        }
        setResolvedMeals(res.data.mealMenuItems);
        setGuestPreviewName(res.data.guestName);
        setMealPhase(true);
      })();
    } else {
      void (async () => {
        const res = await checkInGuestByInternalMagicToken({ eventId, token });
        if (cancelled) return;
        setBusy(false);
        if (!res.success || !res.data) {
          setError(res.error ?? "Check-in failed.");
          return;
        }
        setDone(res.data);
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [eventId, token, instantFlow, mealMenuScope, mealMenuItems]);

  async function submitWithMeal() {
    setError(null);
    if (!mealChoice.trim()) {
      setError("Choose a meal option.");
      return;
    }
    setBusy(true);
    const res = await checkInGuestByInternalMagicToken({
      eventId,
      token,
      mealChoice: mealChoice.trim()
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Check-in failed.");
      return;
    }
    setDone(res.data);
  }

  const showZoom = virtualCapacity > 0 && Boolean(zoomJoinUrl);

  if (instantFlow && busy && !done && !error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: brandColors.primary }}
          aria-hidden
        />
        <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
          Confirming your check-in…
        </p>
      </div>
    );
  }

  if (!instantFlow && busy && !mealPhase) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: brandColors.primary }}
          aria-hidden
        />
        <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
          Loading meal options…
        </p>
      </div>
    );
  }

  if (!instantFlow && mealPhase && !done) {
    return (
      <div className="space-y-5">
        {guestPreviewName ? (
          <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-200" : "text-slate-700")}>
            Hi <span className="font-semibold">{guestPreviewName}</span> — choose your meal for this session.
          </p>
        ) : (
          <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-200" : "text-slate-700")}>
            Choose your meal for this session.
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="sr-only">Meal selection</legend>
          <div className="space-y-2">
            {resolvedMeals.map((opt) => {
              const selected = mealChoice === opt;
              return (
                <label
                  key={opt}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition",
                    selected
                      ? isDark
                        ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/15"
                        : "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/5"
                      : isDark
                        ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                  )}
                >
                  <input
                    type="radio"
                    name="meal"
                    value={opt}
                    checked={selected}
                    onChange={() => setMealChoice(opt)}
                    className="accent-[color:var(--brand-primary)]"
                  />
                  <span className="font-medium">{opt}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error ? (
          isCheckInWindowMessage(error) ? (
            <CheckInWindowNotice message={error} isDark={isDark} />
          ) : (
            <ErrorAlert message={error} isDark={isDark} />
          )
        ) : null}

        <div className="flex flex-col gap-3 pt-1">
          <BrandedButton disabled={busy} primaryColor={brandColors.primary} onClick={() => void submitWithMeal()}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Confirming…
              </>
            ) : (
              "Confirm & check in"
            )}
          </BrandedButton>
          <BrandedLink href={`/register/${eventId}`} variant="secondary" primaryColor={brandColors.primary}>
            Back to event
          </BrandedLink>
        </div>
      </div>
    );
  }

  if (error && !done) {
    if (isCheckInWindowMessage(error)) {
      return (
        <div className="space-y-4">
          <CheckInWindowNotice message={error} isDark={isDark} />
          <BrandedLink href={`/register/${eventId}`} variant="secondary" primaryColor={brandColors.primary}>
            View event page
          </BrandedLink>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} isDark={isDark} />
        <BrandedLink href={`/register/${eventId}`} primaryColor={brandColors.primary}>
          Back to event
        </BrandedLink>
      </div>
    );
  }

  if (!done) return null;

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-2xl border-2 p-5",
          isDark
            ? "border-[color:var(--brand-primary)]/40 bg-[color:var(--brand-primary)]/10"
            : "border-[color:var(--brand-primary)]/25 bg-[color:var(--brand-primary)]/5"
        )}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0"
            style={{ color: brandColors.primary }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug">
              You have successfully been checked in
            </p>
            <p className={cn("mt-1 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
              {done.guest.name}
            </p>
            <p className={cn("mt-3 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
              <span className="font-medium text-inherit">Zoom display name:</span>{" "}
              {done.displayNameHint}
            </p>
          </div>
        </div>
      </div>

      {showZoom && zoomJoinUrl ? (
        <a
          href={zoomJoinUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-semibold shadow-md transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            backgroundColor: brandColors.primary,
            color: contrastingText(brandColors.primary)
          }}
        >
          <Video className="h-5 w-5" aria-hidden />
          Join on Zoom
        </a>
      ) : null}

      {eventType === EventType.HYBRID && showZoom ? (
        <p className={cn("text-center text-xs leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
          Attending in person? You are already checked in — proceed to the venue as scheduled.
        </p>
      ) : null}

      <BrandedLink href={`/register/${eventId}`} variant="secondary" primaryColor={brandColors.primary}>
        View event page
      </BrandedLink>
    </div>
  );
}

function ErrorAlert({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        isDark ? "border-red-500/35 bg-red-950/45 text-red-100" : "border-red-200 bg-red-50 text-red-900"
      )}
      role="alert"
    >
      <p className="font-semibold">Check-in failed</p>
      <p className="mt-1 leading-relaxed">{message}</p>
    </div>
  );
}
