"use client";

import { type ReactNode } from "react";

import { PUBLIC_EVENT_SECTION_IDS } from "@/lib/public-event/templates/sectionIds";
import { SUMMIT_PUBLIC_REGISTRATION_NOTE } from "@/lib/public-event/summitPublicCopy";
import { cn } from "@/lib/utils";

import { PublicRegistrationNote } from "../../../sections/shared/PublicRegistrationNote";
import type { PublicEventSiteSummary } from "../../../siteSummary";

type Props = {
  summary: PublicEventSiteSummary;
  registrationOpen: boolean;
  registerShell: string;
  children: ReactNode;
};

/** Registration embed — `#register-hero` (backend injects form via children). */
export function NightEditionRegisterSection({
  summary,
  registrationOpen,
  registerShell,
  children
}: Props) {
  return (
    <section
      id={PUBLIC_EVENT_SECTION_IDS.registerHero}
      className="scroll-mt-28 border-t border-white/5 bg-[var(--pe-background)] px-5 py-16 md:px-16"
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--pe-on-surface)]">Register</h2>
          <p className="mt-2 text-sm text-[var(--pe-on-surface-variant)]">{summary.statusMessage}</p>
        </div>
        <div className={cn("rounded-2xl pe-glass-panel p-8 md:p-10", registerShell)}>{children}</div>
        {registrationOpen ? (
          <PublicRegistrationNote variant="night-edition" className="mt-6">
            {SUMMIT_PUBLIC_REGISTRATION_NOTE}
          </PublicRegistrationNote>
        ) : null}
        {!registrationOpen ? (
          <p className="mt-4 text-center text-sm text-[var(--pe-on-surface-variant)]">
            Registration is not available for this program right now.
          </p>
        ) : null}
      </div>
    </section>
  );
}
