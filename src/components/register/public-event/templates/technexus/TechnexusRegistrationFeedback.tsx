"use client";

import { AttendMode } from "@prisma/client";
import { ArrowRight, CheckCircle2, Clock, Mail, Smartphone, Vote } from "lucide-react";

import { PollEligibilityCard } from "@/components/register/PollEligibilityCard";
import { Modal } from "@/components/ui/Modal";
import { registrationConfirmationUserMessage } from "@/lib/register/registrationConfirmationCopy";
import type { GuestWithEmailStatus } from "@/types";

type PollNotice = NonNullable<GuestWithEmailStatus["poll"]>;

type RegisteredProps = {
  emailDelivered: boolean;
  smsDelivered: boolean;
  registeredMode: AttendMode;
  pollNotice: PollNotice | null;
  pollInstructionsOpen: boolean;
  onOpenPollInstructions: () => void;
  onClosePollInstructions: () => void;
};

export function TechnexusRegistrationSuccess({
  emailDelivered,
  smsDelivered,
  registeredMode,
  pollNotice,
  pollInstructionsOpen,
  onOpenPollInstructions,
  onClosePollInstructions
}: RegisteredProps) {
  const confirmationCopy = registrationConfirmationUserMessage({
    emailDelivered,
    smsDelivered,
    attendanceMode: registeredMode
  });
  const Icon = smsDelivered && !emailDelivered ? Smartphone : Mail;

  return (
    <div className="tn-registration-success space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
        <div className="h-1 bg-gradient-to-r from-[var(--pe-brand-vivid,#2e5bff)] via-[#1e40af] to-[var(--pe-hero-deep,#0f172a)]" />
        <div className="px-5 py-6 text-center sm:px-8 sm:py-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
          </div>
          <h3 className="font-[family-name:var(--font-tn-display)] text-xl font-bold text-[var(--pe-hero-deep,#0f172a)]">
            You&apos;re registered
          </h3>
          <p
            className={`mx-auto mt-3 flex max-w-md items-start justify-center gap-2 text-sm leading-relaxed ${
              confirmationCopy.tone === "success" ? "text-slate-600" : "text-amber-800"
            }`}
          >
            {confirmationCopy.tone === "success" ? (
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pe-brand-vivid,#2e5bff)]" aria-hidden />
            ) : null}
            <span>{confirmationCopy.message}</span>
          </p>
        </div>
      </div>

      {pollNotice ? (
        <PollEligibilityCard poll={pollNotice} dark={false} onOpenInstructions={onOpenPollInstructions} />
      ) : null}

      {pollNotice ? (
        <Modal
          open={pollInstructionsOpen}
          title="How to vote"
          subtitle={pollNotice.title}
          size="md"
          tone="light"
          onClose={onClosePollInstructions}
        >
          <div className="space-y-4">
            {pollNotice.instructions?.trim() ? (
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                <Vote className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pe-brand-vivid,#2e5bff)]" aria-hidden />
                <p className="whitespace-pre-wrap">{pollNotice.instructions.trim()}</p>
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                The organizer hasn&apos;t added specific voting instructions for this ballot.
                You&apos;ll be guided through identity verification (OTP) when you open the link below.
              </p>
            )}
            <a
              href={pollNotice.ballotUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--pe-brand-vivid,#2e5bff)] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1e40af] sm:w-auto"
            >
              {pollNotice.inWindow ? "Cast your ballot" : "Open ballot page"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

type WaitlistProps = {
  position: number;
};

export function TechnexusWaitlistSuccess({ position }: WaitlistProps) {
  return (
    <div className="tn-registration-success overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="h-1 bg-gradient-to-r from-[var(--pe-brand-vivid,#2e5bff)] to-[var(--pe-hero-deep,#0f172a)]" />
      <div className="px-5 py-6 text-center sm:px-8 sm:py-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pe-section-alt,#dce4f7)] ring-4 ring-[#eef2ff]">
          <Clock className="h-7 w-7 text-[var(--pe-brand-vivid,#2e5bff)]" aria-hidden />
        </div>
        <h3 className="font-[family-name:var(--font-tn-display)] text-xl font-bold text-[var(--pe-hero-deep,#0f172a)]">
          You&apos;re on the waitlist
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
          You are <strong className="text-[var(--pe-hero-deep,#0f172a)]">#{position}</strong> in line.
          We&apos;ll email you the moment a spot opens — your invitation will let you confirm with one
          click.
        </p>
      </div>
    </div>
  );
}
