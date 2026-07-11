import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { CSSProperties } from "react";
import {
  AttendeeTheme,
  EventBlueprintTemplate,
  EventStatus,
  EventType,
  GuestStatus,
  InternalStaffMealMenuScope,
  AttendMode,
  PublicPageTemplate
} from "@prisma/client";

import { InternalStaffRegisterPanel } from "@/components/register/InternalStaffRegisterPanel";
import { PublicEventExperience } from "@/components/register/public-event/PublicEventExperience";
import { publicRegistrationFormDark, resolveSummitColorModeServer } from "@/lib/public-event/templates/resolveColorMode";
import type { PublicEventSiteSummary } from "@/components/register/public-event/siteSummary";
import { PublicRegistrationForm } from "@/components/register/PublicRegistrationForm";
import { RegisterPollCta } from "@/components/register/RegisterPollCta";
import { getEventForPublicPage } from "@/lib/db/events";
import { getPublicElectionView } from "@/lib/public-event/electionView";
import { isPollBallotWindowOpen } from "@/lib/poll/openPoll";
import { isPublicSelfRegistrationOpen, parseMultiDayConfig } from "@/lib/event-schedule/multiDayConfig";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import {
  internalStaffMealStepConfigured,
  parseInternalStaffMealMenuItems
} from "@/lib/internalStaff/mealMenu";
import { isPublicEventExperienceEnabled } from "@/lib/features/publicEventExperience";
import { parsePublicEventExperience } from "@/lib/public-event/experience";
import { prisma } from "@/lib/prisma";
import { publicEventTitleClasses } from "@/lib/ui/eventHeroTitle";
import { getPublicSiteUrl } from "@/lib/url";
import { cn, formatEventPeriod, formatLocationLine } from "@/lib/utils";

type RegisterPageProps = {
  params: { eventId: string };
};

function readServerPrefersDark(): boolean {
  try {
    const h = headers();
    const pref = h.get("sec-ch-prefers-color-scheme")?.toLowerCase();
    if (pref === "dark") return true;
    if (pref === "light") return false;
  } catch {
    /* outside request */
  }
  return false;
}

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
  const event = await getEventForPublicPage(params.eventId);
  if (!event) {
    return { title: "Event · Eventflow", openGraph: { locale: "en_US" } };
  }
  const base = getPublicSiteUrl().replace(/\/$/, "");
  const description =
    (event.description && event.description.trim().slice(0, 300)) ||
    `Register for ${event.name} with ${event.org.name}.`;
  const openGraphPageUrl = `${base}/register/${encodeURIComponent(params.eventId)}`;
  const openGraphImageUrl = `${openGraphPageUrl}/opengraph-image`;
  // og:image / twitter image: provided by `opengraph-image.tsx` in this folder (reliable for WhatsApp
  // and Meta crawlers). Do not point chat previews at a custom /api/og URL only.
  return {
    title: `${event.name} · Eventflow`,
    description,
    openGraph: {
      title: event.name,
      description,
      type: "website",
      url: openGraphPageUrl,
      siteName: "Eventflow",
      locale: "en_US",
      images: [
        {
          url: openGraphImageUrl,
          width: 1200,
          height: 630,
          alt: "Event program"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description,
      images: [openGraphImageUrl]
    }
  };
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  await syncEventStatusForEvent(params.eventId);
  const event = await getEventForPublicPage(params.eventId);
  if (!event) notFound();
  const cancelled = event.status === EventStatus.CANCELLED;
  const completed = event.status === EventStatus.COMPLETED;
  const inviteOnly = !event.allowPublicRegistration;
  const notOpen = event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE;
  const registrationClosedByPolicy =
    !cancelled &&
    !completed &&
    !notOpen &&
    !isPublicSelfRegistrationOpen(event.scheduleMode, event.multiDayConfig);

  const internalStaffSelfCheckIn =
    event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF &&
    inviteOnly &&
    !cancelled &&
    !completed &&
    !notOpen;

  const headerLogo =
    event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF && inviteOnly
      ? event.org.logo ?? event.brandLogoUrl
      : event.brandLogoUrl;

  const footerContact = event.org.internalStaffFooterContact?.trim() || "your organizer or HR team";

  const internalStaffWorkEmailDomain: string | null = null;

  const internalStaffMealMenuScope =
    event.internalStaffMealMenuScope ?? InternalStaffMealMenuScope.ALL_STAFF;
  const internalStaffMealMenuItems = parseInternalStaffMealMenuItems(event.internalStaffMealMenuItems);
  const internalStaffMealSelectionAtCheckIn = internalStaffMealStepConfigured({
    mealMenuEnabled: event.internalStaffMealMenuEnabled,
    mealMenuScope: internalStaffMealMenuScope,
    mealMenuItemsJson: event.internalStaffMealMenuItems,
    mealMenusByBranchJson: event.internalStaffMealMenusByBranch
  });

  const theme = event.attendeeTheme ?? AttendeeTheme.SYSTEM;
  const publicTemplate = event.publicPageTemplate ?? PublicPageTemplate.SUMMIT;
  const serverPrefersDark = readServerPrefersDark();
  const summitColorMode = resolveSummitColorModeServer(theme, serverPrefersDark);
  const brand = event.brandPrimaryColor?.trim() || undefined;
  const isDark = publicRegistrationFormDark(publicTemplate, theme, serverPrefersDark);
  const isLight = !isDark && (theme === AttendeeTheme.LIGHT || theme === AttendeeTheme.SYSTEM);
  const publicExperienceEnabled = isPublicEventExperienceEnabled();

  const statusMessage = cancelled
    ? "This event has been cancelled by the organizer."
    : completed
      ? "This event has ended."
      : notOpen
        ? "Registration is not open yet."
        : internalStaffSelfCheckIn
          ? "Welcome. If you are on the guest list, use the Check-in tab below."
          : inviteOnly
            ? "This program uses invite-only registration for your organization."
            : registrationClosedByPolicy
              ? "Self-registration for this event is limited to day 1 and that window has closed. Contact the organizer to be added."
              : "Browse the program and venue, then complete registration on this page.";

  const [inPersonReg, virtualReg, pollRow, electionView] =
    !cancelled && !completed
      ? await Promise.all([
          prisma.guest.count({
            where: {
              eventId: event.id,
              mode: AttendMode.IN_PERSON,
              status: { not: GuestStatus.DECLINED }
            }
          }),
          prisma.guest.count({
            where: {
              eventId: event.id,
              mode: AttendMode.VIRTUAL,
              status: { not: GuestStatus.DECLINED }
            }
          }),
          prisma.poll.findUnique({
            where: { eventId: event.id },
            select: {
              id: true,
              title: true,
              isActive: true,
              startTime: true,
              endTime: true,
              _count: { select: { positions: true } }
            }
          }),
          getPublicElectionView(event.id)
        ])
      : [0, 0, null, null];

  let remainingSeatsSummary: string | null = null;
  if (!cancelled && !completed) {
    const ri = Math.max(0, event.capacity - inPersonReg);
    const rv = Math.max(0, event.virtualCapacity - virtualReg);
    if (event.type === EventType.IN_PERSON) {
      remainingSeatsSummary = `${ri} seats remaining`;
    } else if (event.type === EventType.VIRTUAL) {
      remainingSeatsSummary =
        event.virtualCapacity > 0 ? `${rv} virtual seats remaining` : null;
    } else {
      remainingSeatsSummary = `${ri} in-person · ${rv} virtual seats open`;
    }
  }

  const summary: PublicEventSiteSummary = {
    name: event.name,
    description: event.description ?? null,
    date: event.date.toISOString(),
    endDate: event.endDate.toISOString(),
    periodLabel: formatEventPeriod(event.date, event.endDate),
    type: event.type,
    capacity: event.capacity,
    virtualCapacity: event.virtualCapacity,
    bannerImageUrl: event.bannerImageUrl,
    headerLogo: headerLogo ?? null,
    orgName: event.org.name,
    locationLine: formatLocationLine(event.location),
    location: {
      name: event.location.name,
      address: event.location.address,
      city: event.location.city,
      latitude: event.location.latitude,
      longitude: event.location.longitude,
      facilityImageUrl: event.location.facilityImageUrl
    },
    programDays:
      parseMultiDayConfig(event.multiDayConfig)?.days.map((d) => ({
        dayIndex: d.dayIndex,
        label: `Day ${d.dayIndex} · ${new Date(d.startsAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          weekday: "short"
        })}`
      })) ?? [
        {
          dayIndex: 1,
          label: new Date(event.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            weekday: "short"
          })
        }
      ],
    statusMessage,
    registerTabLabel: internalStaffSelfCheckIn ? "Check-in" : "Register",
    eventId: event.id,
    remainingSeatsSummary
  };

  const registrationNode = cancelled ? (
    <div className="rounded-lg border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100">
      Registration is closed. This event was cancelled; please contact the organizer if you have questions.
    </div>
  ) : completed ? (
    <div className="rounded-lg border-l-4 border-zinc-700 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-100">
      This event is finished and no longer accepts registrations.
    </div>
  ) : notOpen ? (
    <div className="rounded-lg border-l-4 border-zinc-400 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-100">
      Registration opens when the event is published or live.
    </div>
  ) : internalStaffSelfCheckIn ? (
    <InternalStaffRegisterPanel
      eventId={event.id}
      checkInMode={event.internalStaffCheckInMode}
      workEmailDomain={internalStaffWorkEmailDomain}
      isDark={isDark}
      hasBrandColor={Boolean(brand)}
      zoomJoinUrl={event.zoomJoinUrl}
      virtualCapacity={event.virtualCapacity}
      mealSelectionAtCheckIn={internalStaffMealSelectionAtCheckIn}
      mealMenuScope={internalStaffMealMenuScope}
      mealMenuItems={internalStaffMealMenuItems}
    />
  ) : inviteOnly ? (
    <div className="rounded-lg border-l-4 border-zinc-400 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-100">
      Public self-registration is disabled for this event. Ask your organizer to add you from the Eventflow dashboard,
      or use an invitation link they send you.
    </div>
  ) : registrationClosedByPolicy ? (
    <div className="rounded-lg border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100">
      Registration is closed for new sign-ups. If you still need access, ask the organizer to invite you from the
      dashboard.
    </div>
  ) : (
    // The hero card is now wide enough to render the form in a single, side-by-side view —
    // no more `twoStep` paging. `dark` flips the form's surfaces/labels for the dark theme.
    <PublicRegistrationForm
      event={event}
      dark={isDark}
      technexusLight={publicTemplate === PublicPageTemplate.TECH_NEXUS && !isDark}
    />
  );

  const pollWindowReg = isPollBallotWindowOpen(pollRow);
  const registerPollSlot =
    !cancelled &&
    !completed &&
    pollRow &&
    pollWindowReg &&
    pollRow._count.positions > 0 ? (
      <RegisterPollCta eventId={event.id} pollTitle={pollRow.title} isDark={isDark} brandColor={brand} />
    ) : null;

  if (!publicExperienceEnabled) {
    return (
      <main
        className={cn(
          "mx-auto min-h-screen max-w-2xl p-6",
          isDark && "bg-slate-950 text-slate-100",
          isLight && !isDark && "bg-slate-50 text-slate-900"
        )}
        style={brand ? ({ ["--brand-primary" as string]: brand } as Record<string, string>) : undefined}
      >
        {event.bannerImageUrl ? (
          <div className="relative mb-6 aspect-[21/9] max-h-52 w-full overflow-hidden rounded-xl border border-slate-200/40 bg-slate-200/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.bannerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ) : (
          <div
            className={cn(
              "relative mb-6 min-h-[140px] w-full overflow-hidden rounded-xl border px-5 py-8",
              isDark
                ? "border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950"
                : "border-slate-200 bg-gradient-to-br from-sky-100 via-slate-50 to-slate-100"
            )}
            style={
              brand
                ? ({
                    background: isDark
                      ? `linear-gradient(145deg, color-mix(in srgb, ${brand} 35%, #0f172a), #020617)`
                      : `linear-gradient(145deg, color-mix(in srgb, ${brand} 25%, #f8fafc), #e2e8f0)`
                  } as CSSProperties)
                : undefined
            }
          >
            <p className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", isDark ? "text-zinc-400" : "text-slate-500")}>
              {event.org.name}
            </p>
            <h1
              className={cn(
                "mt-2 max-w-4xl text-balance",
                publicEventTitleClasses(event.name).title,
                !brand && (isDark ? "text-white" : "text-slate-900")
              )}
              style={brand ? { color: brand } : undefined}
            >
              {event.name}
            </h1>
          </div>
        )}
        <div className="flex items-start gap-3">
          {headerLogo ? (
            <div className="shrink-0 rounded-lg border border-slate-200/60 bg-white/90 p-1 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={headerLogo} alt={`${event.org.name} logo`} className="h-11 w-11 object-contain" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "text-2xl font-semibold tracking-tight",
                event.bannerImageUrl ? "" : "sr-only",
                !brand && !isDark && "text-slate-900",
                !brand && isDark && "text-slate-50"
              )}
              style={brand ? { color: brand } : undefined}
            >
              {event.name}
            </h1>
            <p className={cn("mt-2 text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
              {new Date(event.date).toLocaleString()} · {formatLocationLine(event.location)}
            </p>
          </div>
        </div>
        <p className={cn("mt-4", isDark ? "text-slate-200" : "text-slate-700")}>{statusMessage}</p>
        <div className={cn("mt-6 rounded-xl border p-6 shadow-sm", isDark ? "border-slate-700 bg-slate-900/80" : "border-slate-200 bg-white")}>
          {registerPollSlot}
          {registrationNode}
        </div>
        {internalStaffSelfCheckIn ? (
          <footer className={cn("mt-10 text-center text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
            If you believe you should be on this list, contact {footerContact}.
          </footer>
        ) : null}
      </main>
    );
  }

  const registrationOpen =
    !cancelled &&
    !completed &&
    !notOpen &&
    !inviteOnly &&
    !registrationClosedByPolicy;
  const eventOver = cancelled || completed;

  return (
    <PublicEventExperience
      summary={summary}
      experience={parsePublicEventExperience(event.publicExperience)}
      template={publicTemplate}
      theme={theme}
      summitColorMode={summitColorMode}
      brandColor={brand}
      registrationOpen={registrationOpen}
      eventOver={eventOver}
      election={
        electionView && electionView.positions.length > 0 && !eventOver
          ? electionView
          : null
      }
      footerExtra={
        internalStaffSelfCheckIn
          ? `If you believe you should be on this list, contact ${footerContact}.`
          : null
      }
    >
      <>
        {registerPollSlot}
        {registrationNode}
      </>
    </PublicEventExperience>
  );
}
