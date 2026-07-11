"use client";

import { Check, CheckCircle2, Copy, Eye, Lock, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PollPublicHeader } from "./PollPublicHeader";

type Props = {
  emailHint: string;
  receiptRef: string;
  orgName: string;
  brandLogoUrl: string | null;
  accent: string;
  /**
   * Mirrors `Poll.isAnonymous`. When true the page renders the original "anonymous
   * receipt — proof of participation only" copy. When false it renders the
   * attributed-mode copy ("the organizer can see your selections; check your email
   * for your choices").
   */
  isAnonymous: boolean;
};

/**
 * Post-ballot confirmation — used after `router.refresh()` once the thanks cookie is set,
 * or when revisiting while the cookie is still valid.
 */
export function EventPollVoteConfirmedClient({
  emailHint,
  receiptRef,
  orgName,
  brandLogoUrl,
  accent,
  isAnonymous
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptRef);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const receiptLabel = isAnonymous ? "Submission reference" : "Ballot receipt ID";
  const receiptHint = isAnonymous
    ? "Anonymous ballot — proof of participation only"
    : "Attributed ballot — your selections are linked to your profile";
  const ReceiptIcon = isAnonymous ? Lock : Eye;
  const helperCopy = isAnonymous
    ? "This is a participation reference, not a link to your selections. Share it with the organizer if you ever need to confirm that we received your ballot."
    : "The organizer has chosen to run this poll non-anonymously, so they can see how each guest voted. We have emailed a copy of your selections to your inbox for your reference.";

  return (
    <>
      <PollPublicHeader
        orgName={orgName}
        brandLogoUrl={brandLogoUrl}
        accent={accent}
        context="Vote recorded"
        right={
          <div className="flex items-center gap-2 text-[#000000]">
            <Lock className="h-5 w-5 shrink-0" aria-hidden />
          </div>
        }
      />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 sm:py-16">
        <div className="w-full max-w-[600px] text-center">
          <div className="flex flex-col items-center border border-outline-variant/50 bg-surface-container-lowest p-8 shadow-sm sm:p-10">
            <div className="relative mb-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-container">
                <CheckCircle2 className="h-16 w-16 text-accent" aria-hidden />
              </div>
              <div className="absolute -bottom-1 -right-1 flex items-center gap-1 rounded-full border-2 border-white bg-[#000000] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Recorded
              </div>
            </div>

            <h1 className="font-[Manrope,Inter,system-ui] text-3xl font-extrabold tracking-tight text-[#000000] sm:text-4xl">
              Vote confirmed
            </h1>
            <p className="mx-auto mt-3 max-w-[400px] text-lg font-medium leading-relaxed text-[#5e5e5e]">
              Your ballot was recorded. A receipt has been sent to{" "}
              <span className="font-semibold text-[#1b1b1b]">{emailHint}</span>.
            </p>

            <p className="mx-auto mt-4 max-w-[440px] text-sm leading-relaxed text-[#5e5e5e]">
              {helperCopy}
            </p>

            <div className="mt-8 w-full border border-zinc-200 bg-surface-container-low p-4 text-left">
              <div className="mb-2 flex items-center justify-between border-b border-zinc-200 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#5e5e5e]">
                  {receiptLabel}
                </span>
                <button
                  type="button"
                  onClick={copyReceipt}
                  className="rounded p-1 text-[#5e5e5e] transition-colors hover:bg-zinc-200 hover:text-[#1b1b1b]"
                  aria-label={`Copy ${receiptLabel.toLowerCase()}`}
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="break-all font-mono text-xs leading-relaxed text-on-surface-variant">{receiptRef}</p>
              <div className="mt-3 flex items-center gap-2 text-accent">
                <ReceiptIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {receiptHint}
                </span>
              </div>
            </div>

            <Link
              href="/"
              className="mt-8 flex w-full items-center justify-center bg-[#000000] py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Return home
            </Link>
          </div>

          <p className="mx-auto mt-8 max-w-[450px] text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Need help? Contact your event organizer and share the reference above.
          </p>
        </div>
      </main>
    </>
  );
}
