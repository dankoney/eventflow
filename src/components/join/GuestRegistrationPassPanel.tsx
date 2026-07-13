"use client";

import { AttendMode, EventStatus, EventType, GuestStatus, ZoomSessionKind } from "@prisma/client";
import { Calendar, ExternalLink, MapPin, Video } from "lucide-react";
import Image from "next/image";

import type { GuestJoinPassContext } from "@/lib/db/guests";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

function sanitizeHexColor(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`;
  return null;
}

function pickContrastTextColor(hex: string): string {
  const t = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return "#ffffff";
  const r = parseInt(t.slice(0, 2), 16);
  const g = parseInt(t.slice(2, 4), 16);
  const b = parseInt(t.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0a0a" : "#ffffff";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "EV";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "EV";
}

function firstNameOf(name: string): string {
  const f = name.trim().split(/\s+/)[0];
  return f && f.length > 0 ? f : "there";
}

export type GuestRegistrationPassPanelProps = {
  ctx: GuestJoinPassContext;
  brandLogoUrlResolved: string | null;
  qrDataUrl: string | null;
  zoomJoinHref: string | null;
  zoomJoinTracksAttendance: boolean;
  zoomRedirectError?: string | null;
  invitationNotice?: "accepted" | "invalid" | null;
};

function PassCard({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-white px-5 py-5 text-slate-900 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function GuestRegistrationPassPanel({
  ctx,
  brandLogoUrlResolved,
  qrDataUrl,
  zoomJoinHref,
  zoomJoinTracksAttendance,
  zoomRedirectError,
  invitationNotice = null
}: GuestRegistrationPassPanelProps) {
  const accent = sanitizeHexColor(ctx.brandPrimaryColor) ?? "#22d3ee";
  const accentText = pickContrastTextColor(accent);
  const logoUrl = brandLogoUrlResolved;
  const firstName = firstNameOf(ctx.guestName);
  const when = formatDate(ctx.eventDate);
  const directionsUrl =
    ctx.locationName && ctx.locationAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ctx.locationName} ${ctx.locationAddress}`)}`
      : null;

  const inPerson =
    ctx.mode === AttendMode.IN_PERSON ||
    (ctx.mode == null && ctx.eventType === EventType.IN_PERSON);
  const virtual =
    ctx.mode === AttendMode.VIRTUAL ||
    (ctx.mode == null && ctx.eventType === EventType.VIRTUAL);
  const hybrid = ctx.eventType === EventType.HYBRID;
  const sessionNoun = ctx.zoomSessionKind === ZoomSessionKind.MEETING ? "meeting" : "webinar";

  if (ctx.eventStatus === EventStatus.CANCELLED || ctx.eventStatus === EventStatus.COMPLETED) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        This event is no longer active.
      </div>
    );
  }

  if (invitationNotice === "invalid") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        This invitation link is invalid or was already used. Contact the organizer if you still need access.
      </div>
    );
  }

  const lede = inPerson
    ? `Your spot for ${ctx.eventName} is locked in. The QR badge below is your fast-lane check-in — bring it on your phone.`
    : virtual
      ? `You're registered for the virtual ${sessionNoun}. Use your personal join link below when the session starts.`
      : hybrid
        ? `You're registered for ${ctx.eventName}. Use the details below for in-person check-in or virtual join.`
        : `You're registered for ${ctx.eventName}.`;

  const footerCaption = inPerson
    ? "Show this page at the door for a fast check-in."
    : virtual
      ? "Save this page — your join link is personal to you."
      : "Keep this page handy for check-in or virtual join.";

  return (
    <div className="overflow-hidden rounded-2xl bg-black text-white shadow-2xl ring-1 ring-zinc-800">
      <div className="px-6 pb-2 pt-8 text-center">
        <div className="flex flex-col items-center gap-3">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={ctx.organizationName}
              width={48}
              height={48}
              className="h-12 w-12 rounded-xl object-cover bg-zinc-900"
              unoptimized
            />
          ) : (
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-lg font-extrabold"
              style={{ backgroundColor: accent, color: accentText }}
            >
              {initials(ctx.organizationName)}
            </span>
          )}
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            {ctx.organizationName}
          </p>
        </div>
        <h1 className="mt-6 font-[family-name:var(--font-manrope,ui-sans-serif)] text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">
          You&apos;re registered, {firstName}.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">{lede}</p>
      </div>

      <div className="space-y-4 px-4 py-6">
        {invitationNotice === "accepted" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Invitation accepted — you are on the roster.
          </div>
        ) : null}

        {zoomRedirectError ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {zoomRedirectError}
          </div>
        ) : null}

        <PassCard className="text-center">
          <p className="text-lg font-bold text-slate-900">{ctx.eventName}</p>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {when}
          </p>
          {ctx.eventLocation ? (
            <p className="mt-2 flex items-start justify-center gap-2 text-sm text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span>
                {ctx.eventLocation}
                {directionsUrl ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline"
                      style={{ color: accent }}
                    >
                      Get directions ↗
                    </a>
                  </>
                ) : null}
              </span>
            </p>
          ) : null}
        </PassCard>

        {(inPerson || hybrid) && qrDataUrl ? (
          <PassCard className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">
              Your check-in QR
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Check-in QR code"
              width={220}
              height={220}
              className="mx-auto mt-4 rounded-xl border border-zinc-100"
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Save this page or screenshot the badge. Staff will scan it at the venue door for a fast
              check-in.
            </p>
          </PassCard>
        ) : null}

        {(virtual || (hybrid && zoomJoinHref)) && zoomJoinHref ? (
          <PassCard>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">
              Virtual join link
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Your personal Zoom link works from desktop, mobile, or the Zoom app. Save this page —
              don&apos;t share the link.
            </p>
            <a
              href={zoomJoinHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-90"
              style={{ backgroundColor: accent, color: accentText }}
            >
              <Video className="h-4 w-4" aria-hidden />
              Join Zoom
              <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </a>
            <p className="mt-2 text-xs text-slate-500">
              {zoomJoinTracksAttendance
                ? "Records your attendance for this event, then opens Zoom in a new tab."
                : "Opens Zoom in a new tab."}
            </p>
          </PassCard>
        ) : null}

        {(virtual || hybrid) && (ctx.zoomMeetingId || ctx.zoomPasscode) ? (
          <PassCard>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900">
              Meeting details
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {ctx.zoomMeetingId ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Meeting ID</dt>
                  <dd className="font-mono font-medium text-slate-900">{ctx.zoomMeetingId}</dd>
                </div>
              ) : null}
              {ctx.zoomPasscode ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Passcode</dt>
                  <dd className="font-mono font-medium text-slate-900">{ctx.zoomPasscode}</dd>
                </div>
              ) : null}
            </dl>
          </PassCard>
        ) : null}

        {ctx.status === GuestStatus.CHECKED_IN || ctx.status === GuestStatus.JOINED ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100">
            {ctx.status === GuestStatus.CHECKED_IN
              ? "You're checked in for this event."
              : `You're marked as joined for this ${sessionNoun}.`}
          </div>
        ) : null}
      </div>

      <p className="border-t border-zinc-800 px-6 py-4 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {footerCaption}
      </p>
    </div>
  );
}
