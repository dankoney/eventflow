import Link from "next/link";
import { type ReactNode } from "react";

import type { EventPollBranding, EventPollEventSummary } from "./pollPageTypes";

const year = new Date().getFullYear();

/**
 * Public ballot chrome — warm off-white canvas, shared footer, optional event hero
 * for closed / empty states. Gate and ballot views bring their own top bars.
 */
export function EventPollShell({
  branding,
  eventSummary,
  showEventHero = true,
  isAnonymous = true,
  children
}: {
  branding: EventPollBranding;
  eventSummary: EventPollEventSummary;
  /** When false, gate/ballot layouts own the headline; only the footer is shared. */
  showEventHero?: boolean;
  /**
   * Mirrors `Poll.isAnonymous`. Drives the footer copy ("anonymous ballot" vs
   * "attributed ballot — admins can see selections"). Defaults to true so
   * closed-state notices keep the original secret-ballot wording.
   */
  isAnonymous?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f8] font-sans text-[#1b1b1b] antialiased">
      {showEventHero ? (
        <div className="border-b border-outline-variant/80 bg-surface-container-lowest shadow-sm">
          <div className="mx-auto flex max-w-3xl items-start gap-4 px-4 py-8 sm:px-6">
            {branding.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- transactional public page
              <img
                src={branding.brandLogoUrl}
                alt={branding.orgName}
                className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-outline-variant/40"
              />
            ) : (
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white"
                style={{ background: branding.accent }}
                aria-hidden
              >
                {branding.orgName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-[Manrope,Inter,system-ui] text-base font-extrabold tracking-tight text-[#1b1b1b] sm:text-lg">
                {branding.orgName}
              </p>
              <h1 className="mt-1 font-[Manrope,Inter,system-ui] text-2xl font-extrabold tracking-tight text-[#1b1b1b] sm:text-3xl">
                {eventSummary.name}
              </h1>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">
                Ballot status
              </p>
              {eventSummary.description?.trim() ? (
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  {eventSummary.description.trim().slice(0, 280)}
                  {eventSummary.description.length > 280 ? "…" : ""}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="mt-auto border-t border-outline-variant/80 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-8">
          <p className="text-center text-[11px] font-semibold tracking-[0.04em] text-[#5e5e5e] sm:text-left">
            © {year} {branding.orgName}.{" "}
            {isAnonymous
              ? "Anonymous ballot — choices are not linked to voters."
              : "Attributed ballot — the organizer can see how each guest voted."}
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c9c9c]">
            <Link
              href="/"
              className="transition-colors hover:text-[#1b1b1b] hover:underline hover:underline-offset-4"
            >
              Powered by Eventflow Pro
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
