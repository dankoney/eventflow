import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PollPublicHeaderProps = {
  orgName: string;
  brandLogoUrl: string | null;
  accent: string;
  /** Optional context line under the org name (e.g. event name or "Identity verification"). */
  context?: string | null;
  /** Optional element shown on the right (status pill, secure-entry badge, etc.). */
  right?: ReactNode;
};

/**
 * Shared sticky top bar for every public poll surface (gate, ballot, confirmation).
 *
 * Hierarchy intent: the **organization** identity leads (logo + name, large). The
 * Eventflow brand is reduced to a small "Powered by Eventflow Pro" mark on the right
 * so the ballot reads as the organization's own page first.
 */
export function PollPublicHeader({
  orgName,
  brandLogoUrl,
  accent,
  context,
  right
}: PollPublicHeaderProps) {
  const initials = orgName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant/80 bg-surface-container-lowest shadow-sm">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- transactional public page
            <img
              src={brandLogoUrl}
              alt={orgName}
              className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-outline-variant/40"
            />
          ) : (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: accent }}
              aria-hidden
            >
              {initials || "·"}
            </span>
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-[Manrope,Inter,system-ui] text-base font-extrabold tracking-tight text-[#1b1b1b]",
                "sm:text-lg"
              )}
            >
              {orgName}
            </p>
            {context ? (
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5e5e5e]">
                {context}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {right}
          <Link
            href="/"
            className="hidden text-right text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9c9c9c] transition-colors hover:text-[#1b1b1b] sm:block"
            title="Powered by Eventflow Pro"
          >
            Powered by
            <br />
            Eventflow Pro
          </Link>
        </div>
      </div>
    </header>
  );
}
