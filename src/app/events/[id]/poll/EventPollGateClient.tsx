"use client";

import { ArrowRight, BookOpen, Info, Loader2, Lock, ShieldCheck, Verified } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent
} from "react";

import { Modal } from "@/components/ui/Modal";
import { requestVotingOTP, verifyVotingOTP } from "@/lib/actions/poll.actions";
import { cn } from "@/lib/utils";

import { PollPublicHeader } from "./PollPublicHeader";

type EventPollGateClientProps = {
  eventId: string;
  accent: string;
  pollTitle: string;
  pollStartTime: string;
  pollEndTime: string;
  /**
   * Optional procedural voting instructions (OTP, deadlines, rules). When
   * present, rendered below the window-times row so voters can read them
   * before requesting a code.
   */
  pollInstructions: string | null;
  orgName: string;
  brandLogoUrl: string | null;
  /**
   * Mirrors `Poll.isAnonymous`. Drives the gate disclaimer + footer copy.
   */
  isAnonymous: boolean;
};

type GatePhase =
  | { kind: "email" }
  | {
      kind: "otp";
      guestId: string;
      channels: Array<"email" | "sms">;
      emailHint: string | null;
      phoneHint: string | null;
      expiresAt: string;
    };

export function EventPollGateClient({
  eventId,
  accent,
  pollTitle,
  pollStartTime,
  pollEndTime,
  pollInstructions,
  orgName,
  brandLogoUrl,
  isAnonymous
}: EventPollGateClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<GatePhase>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [pendingRequest, startRequest] = useTransition();
  const [pendingVerify, startVerify] = useTransition();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);
  const trimmedInstructions = pollInstructions?.trim() ?? "";
  const hasInstructions = trimmedInstructions.length > 0;

  const code = digits.join("");

  const focusOtp = useCallback((index: number) => {
    otpRefs.current[index]?.focus();
  }, []);

  useEffect(() => {
    if (phase.kind === "otp") {
      focusOtp(0);
    }
  }, [phase.kind, focusOtp]);

  function resetDigits() {
    setDigits(["", "", "", "", "", ""]);
  }

  function handleRequest(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter the email you registered with.");
      return;
    }
    startRequest(async () => {
      const res = await requestVotingOTP({ eventId, email: trimmed });
      if (!res.success || !res.data) {
        setError(res.error ?? "We couldn't send your code. Please try again.");
        return;
      }
      resetDigits();
      setPhase({
        kind: "otp",
        guestId: res.data.guestId,
        channels: res.data.channels,
        emailHint: res.data.emailHint,
        phoneHint: res.data.phoneHint,
        expiresAt: res.data.expiresAt.toString()
      });
    });
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase.kind !== "otp") return;
    setError(null);
    setInfo(null);
    const cleaned = code.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length !== 6) {
      setError("Enter the 6-digit code from your email or SMS.");
      return;
    }
    startVerify(async () => {
      const res = await verifyVotingOTP({ guestId: phase.guestId, code: cleaned });
      if (!res.success || !res.data) {
        setError(res.error ?? "That code did not work.");
        return;
      }
      router.refresh();
    });
  }

  function handleResend() {
    if (phase.kind !== "otp") return;
    setError(null);
    setInfo(null);
    startRequest(async () => {
      const res = await requestVotingOTP({ eventId, email: email.trim() });
      if (!res.success || !res.data) {
        setError(res.error ?? "We couldn't resend your code.");
        return;
      }
      setPhase({
        kind: "otp",
        guestId: res.data.guestId,
        channels: res.data.channels,
        emailHint: res.data.emailHint,
        phoneHint: res.data.phoneHint,
        expiresAt: res.data.expiresAt.toString()
      });
      resetDigits();
      setInfo(`New code sent via ${formatChannels(res.data.channels)}.`);
    });
  }

  function setDigitAt(index: number, raw: string) {
    const d = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev] as string[];
      next[index] = d;
      return next;
    });
    if (d && index < 5) {
      requestAnimationFrame(() => focusOtp(index + 1));
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      focusOtp(index - 1);
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""] as string[];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]!;
    setDigits(next);
    const last = Math.min(pasted.length, 5);
    requestAnimationFrame(() => focusOtp(last));
  }

  return (
    <>
      <PollPublicHeader
        orgName={orgName}
        brandLogoUrl={brandLogoUrl}
        accent={accent}
        context={pollTitle}
        right={
          <div className="flex items-center gap-2 text-[#000000]">
            <Verified className="h-5 w-5 shrink-0" aria-hidden />
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] sm:inline">
              Secure entry
            </span>
          </div>
        }
      />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 sm:py-16">
        <div className="w-full max-w-[480px] border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-sm sm:p-10">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e2e2e2]">
              <Lock className="h-6 w-6 text-[#000000]" aria-hidden />
            </div>
            <h1 className="font-[Manrope,Inter,system-ui] text-2xl font-bold tracking-tight text-[#1b1b1b]">
              Identity Verification
            </h1>
            <p className="mx-auto mt-2 max-w-[320px] text-base font-medium leading-relaxed text-on-surface-variant">
              To ensure a fair election, please verify your identity for{" "}
              <span className="text-[#1b1b1b]">{pollTitle}</span>.
            </p>
            <p className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#5e5e5e]">
              <span className="rounded border border-outline-variant/60 bg-[#f3f3f3] px-2.5 py-1">
                Opens {formatStamp(pollStartTime)}
              </span>
              <span className="rounded border border-outline-variant/60 bg-[#f3f3f3] px-2.5 py-1">
                Closes {formatStamp(pollEndTime)}
              </span>
            </p>
            {!isAnonymous ? (
              <p className="mt-4 rounded border border-amber-300/70 bg-amber-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Attributed ballot — the organizer can see how each guest voted.
              </p>
            ) : null}
            {hasInstructions ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setInstructionsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent transition hover:border-accent/70 hover:bg-accent/[0.12]"
                  aria-haspopup="dialog"
                  aria-expanded={instructionsOpen}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden />
                  How to vote
                </button>
              </div>
            ) : null}
          </div>

          {phase.kind === "email" ? (
            <form onSubmit={handleRequest} className="mt-8 space-y-6" noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="poll-gate-email"
                  className="text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e]"
                >
                  Work email
                </label>
                <div className="relative">
                  <input
                    id="poll-gate-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={cn(
                      "h-12 w-full border border-outline-variant bg-white py-2 pl-4 pr-[7.5rem] text-base font-medium text-[#1b1b1b] outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                    )}
                  />
                  <button
                    type="submit"
                    disabled={pendingRequest}
                    className="absolute right-2 top-2 flex h-8 items-center bg-[#000000] px-4 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingRequest ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      "Send OTP"
                    )}
                  </button>
                </div>
              </div>

              <p className="text-center text-xs text-on-surface-variant">
                We&apos;ll send a code to the email and phone on file for this event, when available.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="mt-8 space-y-6" noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="poll-gate-email-readonly"
                  className="text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e]"
                >
                  Work email
                </label>
                <div className="relative">
                  <input
                    id="poll-gate-email-readonly"
                    type="email"
                    readOnly
                    value={email}
                    className="h-12 w-full cursor-default border border-outline-variant bg-[#f3f3f3] px-4 text-base font-medium text-[#1b1b1b] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhase({ kind: "email" });
                      resetDigits();
                      setError(null);
                      setInfo(null);
                    }}
                    className="absolute right-2 top-2 h-8 px-2 text-[11px] font-semibold uppercase tracking-wider text-accent underline-offset-4 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-end justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e]">
                    Verification code
                  </span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={pendingRequest}
                    className="text-[11px] font-semibold uppercase tracking-wider text-accent underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingRequest ? "Sending…" : "Resend code"}
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  Code sent via {formatChannels(phase.channels)}. Expires in 10 minutes.{" "}
                  {[
                    phase.emailHint && phase.channels.includes("email") ? phase.emailHint : null,
                    phase.phoneHint && phase.channels.includes("sms") ? phase.phoneHint : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="grid grid-cols-6 gap-2" onPaste={handleOtpPaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={d}
                      onChange={(e) => setDigitAt(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="h-14 border border-outline-variant bg-white text-center font-[Manrope,Inter,system-ui] text-2xl font-bold text-[#1b1b1b] outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      aria-label={`Digit ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={pendingVerify || code.length !== 6}
                className="flex h-14 w-full items-center justify-center gap-2 bg-[#000000] text-base font-bold text-white transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pendingVerify ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Verifying…
                  </>
                ) : (
                  <>
                    Verify &amp; continue
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </>
                )}
              </button>
            </form>
          )}

          {error ? (
            <p className="mt-6 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>
          ) : null}
          {info ? (
            <p className="mt-6 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>
          ) : null}

          <div className="mt-8 flex items-center justify-center gap-2 border-t border-outline-variant/50 pt-6">
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              TLS encryption in transit · {isAnonymous ? "Secret ballot" : "Attributed ballot"}
            </span>
          </div>
        </div>
      </main>

      {hasInstructions ? (
        <Modal
          open={instructionsOpen}
          title="How to vote"
          subtitle={pollTitle}
          size="md"
          onClose={() => setInstructionsOpen(false)}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border-l-4 border-accent bg-accent/[0.06] p-4 text-sm leading-relaxed text-[#1b1b1b]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <p className="whitespace-pre-wrap">{trimmedInstructions}</p>
            </div>
            <p className="text-xs text-on-surface-variant">
              Voting window: {formatStamp(pollStartTime)} → {formatStamp(pollEndTime)}.
            </p>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function formatChannels(channels: Array<"email" | "sms">): string {
  if (channels.length === 0) return "the configured channels";
  if (channels.length === 1) {
    return channels[0] === "email" ? "email" : "SMS";
  }
  return "email and SMS";
}

function formatStamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}
