"use client";

import { AttendeeTheme, PublicPageTemplate } from "@prisma/client";
import { type ReactNode, useEffect, useState } from "react";

import type { PublicElectionView } from "@/lib/public-event/electionView";
import type { PublicEventExperiencePayload } from "@/lib/public-event/experience";
import {
  type SummitColorMode
} from "@/lib/public-event/templates/resolveColorMode";

import { PublicEventTranslationProvider, usePublicEventTranslation } from "./i18n/PublicEventTranslationProvider";
import { PublicEventDarkSummitExperience } from "./PublicEventDarkSummitExperience";
import { PublicEventSummitExperience } from "./PublicEventSummitExperience";
import { NightEditionTemplate } from "./templates/night-edition/NightEditionTemplate";
import { TechnexusTemplate } from "./templates/technexus/TechnexusTemplate";
import type { PublicEventSiteSummary } from "./siteSummary";

export type { PublicEventSiteSummary } from "./siteSummary";

type PublicEventExperienceProps = {
  summary: PublicEventSiteSummary;
  experience: PublicEventExperiencePayload;
  /** Layout template (Template 1 Summit vs Template 2 Night Edition). */
  template: PublicPageTemplate;
  /** Color mode for Template 1 (Summit). */
  theme: AttendeeTheme;
  /** Server-resolved Summit light/dark (avoids hydration flip on SYSTEM theme). */
  summitColorMode: SummitColorMode;
  brandColor?: string;
  registrationOpen?: boolean;
  eventOver?: boolean;
  footerExtra?: string | null;
  election?: PublicElectionView | null;
  children: ReactNode;
};

function useSummitColorMode(theme: AttendeeTheme, serverMode: SummitColorMode): SummitColorMode {
  const [mode, setMode] = useState(serverMode);

  useEffect(() => {
    if (theme === AttendeeTheme.LIGHT) {
      setMode("light");
      return;
    }
    if (theme === AttendeeTheme.DARK) {
      setMode("dark");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setMode(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return mode;
}

function PublicEventExperienceRouter({
  template,
  theme,
  summitColorMode,
  brandColor,
  footerExtra,
  registrationOpen,
  eventOver,
  election,
  children
}: Omit<PublicEventExperienceProps, "summary" | "experience">) {
  const { summary, experience } = usePublicEventTranslation();
  const colorMode = useSummitColorMode(theme, summitColorMode);

  if (template === PublicPageTemplate.TECH_NEXUS) {
    return (
      <TechnexusTemplate
        summary={summary}
        experience={experience}
        colorMode={colorMode}
        brandColor={brandColor}
        footerExtra={footerExtra}
        registrationOpen={registrationOpen}
        eventOver={eventOver}
        election={election}
      >
        {children}
      </TechnexusTemplate>
    );
  }

  if (template === PublicPageTemplate.NIGHT_EDITION) {
    return (
      <NightEditionTemplate
        summary={summary}
        experience={experience}
        brandColor={brandColor}
        footerExtra={footerExtra}
        registrationOpen={registrationOpen}
        eventOver={eventOver}
        election={election}
      >
        {children}
      </NightEditionTemplate>
    );
  }

  if (colorMode === "dark") {
    return (
      <PublicEventDarkSummitExperience
        summary={summary}
        experience={experience}
        brandColor={brandColor}
        footerExtra={footerExtra}
        registrationOpen={registrationOpen}
        eventOver={eventOver}
        election={election}
      >
        {children}
      </PublicEventDarkSummitExperience>
    );
  }

  return (
    <PublicEventSummitExperience
      summary={summary}
      experience={experience}
      brandColor={brandColor}
      footerExtra={footerExtra}
      registrationOpen={registrationOpen}
      eventOver={eventOver}
      election={election}
    >
      {children}
    </PublicEventSummitExperience>
  );
}

/**
 * Routes the public registration page:
 * - `publicPageTemplate` selects the layout family (Summit vs Night Edition).
 * - `attendeeTheme` selects light/dark within Template 1 (Summit) and registration form styling.
 */
export function PublicEventExperience({
  summary,
  experience,
  template,
  theme,
  summitColorMode,
  brandColor,
  registrationOpen = true,
  eventOver = false,
  footerExtra,
  election = null,
  children
}: PublicEventExperienceProps) {
  return (
    <PublicEventTranslationProvider eventId={summary.eventId} summary={summary} experience={experience}>
      <PublicEventExperienceRouter
        template={template}
        theme={theme}
        summitColorMode={summitColorMode}
        brandColor={brandColor}
        footerExtra={footerExtra}
        registrationOpen={registrationOpen}
        eventOver={eventOver}
        election={election}
      >
        {children}
      </PublicEventExperienceRouter>
    </PublicEventTranslationProvider>
  );
}
