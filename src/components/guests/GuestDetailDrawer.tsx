"use client";

import { AttendMode, GuestJoinSource, GuestStatus } from "@prisma/client";
import { Briefcase, Clock, Mail, MessageSquare, QrCode, Send, User, Video, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { GuestStatusBadge } from "@/components/guests/GuestStatusBadge";
import { Button } from "@/components/ui/Button";
import { resendGuestInvitationEmail, resendGuestInvitationSms } from "@/lib/actions/guest.actions";
import type { GuestWithRep } from "@/lib/db/guests";
import { referralSourceLabel, registrationCountryLabel } from "@/lib/register/countryOptions";
import { cn, formatDate } from "@/lib/utils";
import type { GuestStatus as GuestStatusT } from "@/types";

import QRCode from "qrcode";

type GuestDetailDrawerProps = {
  guest: GuestWithRep | null;
  onClose: () => void;
  /** Open the edit modal with this guest (drawer closes first in parent). */
  onRequestEdit?: (g: GuestWithRep) => void;
  /** Whether the current user may edit this guest (rep scope + assignment). */
  canEdit?: boolean;
  /** Open the custom SMS / email dialog for this guest. */
  onRequestCustomMessage?: (g: GuestWithRep) => void;
  canSendCustomMessage?: boolean;
};

function Panel({
  title,
  icon: Icon,
  children,
  className
}: {
  title: string;
  icon: typeof User;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/[0.03]",
        className
      )}
    >
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  children,
  redacted
}: {
  label: string;
  children: ReactNode;
  redacted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-1 border-b border-zinc-100 py-2.5 last:border-0">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-sm text-zinc-900",
          redacted && "select-none blur-[3px]"
        )}
        title={redacted ? "Contact details limited for this guest" : undefined}
      >
        {children}
      </dd>
    </div>
  );
}

export function GuestDetailDrawer({
  guest,
  onClose,
  onRequestEdit,
  canEdit = false,
  onRequestCustomMessage,
  canSendCustomMessage = false
}: GuestDetailDrawerProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [smsResendBusy, setSmsResendBusy] = useState(false);
  const [smsResendFeedback, setSmsResendFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!guest?.id) return;
    setResendFeedback(null);
    setSmsResendFeedback(null);
    setResendBusy(false);
    setSmsResendBusy(false);
  }, [guest?.id]);

  useEffect(() => {
    if (!guest?.qrCode) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(guest.qrCode, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => setQrDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [guest?.qrCode]);

  useEffect(() => {
    if (!guest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guest, onClose]);

  if (!guest) return null;

  const virtualZoomHref =
    guest.mode !== AttendMode.IN_PERSON ? guest.openZoomJoinUrl ?? guest.zoomLink : null;

  const showEdit = Boolean(canEdit && onRequestEdit && !guest.contactsRedacted);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-zinc-950/50 backdrop-blur-[2px]"
        aria-label="Close guest details"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l-2 border-zinc-900 bg-zinc-50 shadow-2xl lg:max-w-lg">
        <header className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Guest record</p>
              <h2 className="mt-1.5 truncate text-xl font-bold tracking-tight text-white">{guest.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <GuestStatusBadge status={guest.status as GuestStatusT} />
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15">
                  Tier {guest.tier}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15">
                  {guest.mode == null ? "Undecided" : guest.mode === AttendMode.VIRTUAL ? "Virtual" : "In person"}
                </span>
                {guest.joinSource === GuestJoinSource.EXTERNAL_JOIN ? (
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30">
                    External join
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              {showEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                  onClick={() => onRequestEdit?.(guest)}
                >
                  Edit guest
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <Panel title="Contact" icon={User}>
            <dl>
              <DetailRow label="Email" redacted={guest.contactsRedacted}>
                {guest.email}
              </DetailRow>
              {guest.phone ? (
                <DetailRow label="Phone" redacted={guest.contactsRedacted}>
                  {guest.phone}
                </DetailRow>
              ) : null}
              {guest.company ? <DetailRow label="Company">{guest.company}</DetailRow> : null}
              {guest.jobTitle ? <DetailRow label="Job title">{guest.jobTitle}</DetailRow> : null}
              {guest.country ? (
                <DetailRow label="Region">
                  {registrationCountryLabel(guest.country) ?? guest.country}
                </DetailRow>
              ) : null}
              {guest.referralSource ? (
                <DetailRow label="Referral">
                  {referralSourceLabel(guest.referralSource) ?? guest.referralSource}
                </DetailRow>
              ) : null}
              {guest.accessibilityNotes ? (
                <DetailRow label="Accessibility">
                  <span className="whitespace-pre-wrap">{guest.accessibilityNotes}</span>
                </DetailRow>
              ) : null}
              {guest.dietary ? <DetailRow label="Dietary">{guest.dietary}</DetailRow> : null}
            </dl>
          </Panel>

          <Panel title="Program & ownership" icon={Briefcase}>
            <dl>
              {guest.staffEmployeeId ? <DetailRow label="Staff ID">{guest.staffEmployeeId}</DetailRow> : null}
              {guest.department ? <DetailRow label="Department">{guest.department}</DetailRow> : null}
              {guest.branch ? <DetailRow label="Branch">{guest.branch}</DetailRow> : null}
              <DetailRow label="Guest group">{guest.eventGuestGroupName ?? "—"}</DetailRow>
              <DetailRow label="Rep">{guest.repName ?? guest.repEmail ?? "—"}</DetailRow>
            </dl>
          </Panel>

          {!guest.contactsRedacted && guest.canResendInvitation ? (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-900">Invitation email</h3>
              <p className="mt-1 text-xs leading-relaxed text-indigo-900/80">
                Resend the same message they received when added (QR, venue, Zoom, or staff check-in link as
                applicable).
              </p>
              {resendFeedback ? (
                <p
                  className={cn(
                    "mt-2 text-xs font-medium",
                    resendFeedback.ok ? "text-zinc-800" : "text-red-700"
                  )}
                  role="status"
                >
                  {resendFeedback.text}
                </p>
              ) : null}
              {smsResendFeedback ? (
                <p
                  className={cn(
                    "mt-2 text-xs font-medium",
                    smsResendFeedback.ok ? "text-zinc-800" : "text-red-700"
                  )}
                  role="status"
                >
                  {smsResendFeedback.text}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="border-indigo-200 bg-white text-xs font-semibold text-indigo-900 hover:bg-indigo-50"
                  disabled={resendBusy}
                  onClick={() => {
                    void (async () => {
                      setResendFeedback(null);
                      setResendBusy(true);
                      const res = await resendGuestInvitationEmail({
                        eventId: guest.eventId,
                        guestId: guest.id
                      });
                      setResendBusy(false);
                      if (!res.success) {
                        setResendFeedback({ ok: false, text: res.error ?? "Could not send." });
                        return;
                      }
                      setResendFeedback({ ok: true, text: `Sent to ${guest.email}.` });
                    })();
                  }}
                >
                  <Mail className="mr-2 inline h-3.5 w-3.5" aria-hidden />
                  {resendBusy ? "Sending…" : "Resend invitation"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-indigo-200 bg-white text-xs font-semibold text-indigo-900 hover:bg-indigo-50"
                  disabled={smsResendBusy || !guest.phone?.trim()}
                  title={
                    !guest.phone?.trim()
                      ? "Add an international mobile number (for example +14155552671) on the guest record to send SMS reminders."
                      : undefined
                  }
                  onClick={() => {
                    void (async () => {
                      setSmsResendFeedback(null);
                      setSmsResendBusy(true);
                      const res = await resendGuestInvitationSms({
                        eventId: guest.eventId,
                        guestId: guest.id
                      });
                      setSmsResendBusy(false);
                      if (!res.success) {
                        setSmsResendFeedback({ ok: false, text: res.error ?? "Could not send SMS." });
                        return;
                      }
                      setSmsResendFeedback({
                        ok: true,
                        text: guest.phone ? `SMS sent to ${guest.phone}.` : "SMS sent."
                      });
                    })();
                  }}
                >
                  <MessageSquare className="mr-2 inline h-3.5 w-3.5" aria-hidden />
                  {smsResendBusy ? "Sending…" : "Resend SMS reminder"}
                </Button>
              </div>
            </section>
          ) : !guest.contactsRedacted && guest.status === GuestStatus.DECLINED ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-100/80 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              This guest declined. Invitation and SMS resend are disabled.
            </p>
          ) : !guest.contactsRedacted && !guest.canResendInvitation ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-100/80 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              Resend is only available while the event is published or live and before the scheduled end window (plus
              grace).
            </p>
          ) : null}

          {canSendCustomMessage && !guest.contactsRedacted && guest.status !== GuestStatus.DECLINED ? (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/[0.03]">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-700">Custom message</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Send a one-off SMS (up to 300 characters) or a branded email with subject, headline, and message body.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs font-semibold"
                  onClick={() => onRequestCustomMessage?.(guest)}
                >
                  <Send className="mr-2 inline h-3.5 w-3.5" aria-hidden />
                  Message guest
                </Button>
              </div>
            </section>
          ) : null}

          <Panel title="Activity" icon={Clock}>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-300 ring-2 ring-zinc-100" aria-hidden />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Registered</p>
                  <p className="mt-0.5 text-sm text-zinc-800">{formatDate(guest.createdAt)}</p>
                </div>
              </li>
              {guest.status === GuestStatus.CHECKED_IN || guest.status === GuestStatus.JOINED ? (
                <li className="flex gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-500 ring-2 ring-zinc-200"
                    aria-hidden
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {guest.status === GuestStatus.JOINED ? "Joined (Zoom)" : "Checked in"}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-800">
                      {guest.checkedInAt ? formatDate(guest.checkedInAt) : "—"}
                      {guest.latestCheckInMeal ? (
                        <span className="mt-1 block text-xs text-zinc-600">Meal: {guest.latestCheckInMeal}</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
          </Panel>

          {guest.mode === AttendMode.IN_PERSON && qrDataUrl && !guest.contactsRedacted ? (
            <Panel title="Check-in QR" icon={QrCode}>
              <img
                src={qrDataUrl}
                alt="Guest check-in QR"
                className="mx-auto max-w-[220px] rounded-lg border-2 border-zinc-200 bg-white p-2 shadow-inner"
              />
            </Panel>
          ) : null}

          {guest.mode === AttendMode.VIRTUAL && virtualZoomHref && !guest.contactsRedacted ? (
            <Panel title="Virtual join" icon={Video}>
              <a
                href={virtualZoomHref}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-600"
              >
                {virtualZoomHref}
              </a>
            </Panel>
          ) : null}

          {guest.contactsRedacted ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              QR codes and join links are hidden — this guest is not assigned to you.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
