import { notFound } from "next/navigation";
import {
  AttendeeTheme,
  EventBlueprintTemplate,
  EventStatus,
  EventType,
  InternalStaffCheckInMode,
  InternalStaffMealMenuScope
} from "@prisma/client";

import { InternalStaffMagicCheckInClient } from "@/components/register/InternalStaffMagicCheckInClient";
import {
  resolveDefaultEventBrandColors,
  resolveDefaultEventBrandLogoUrl
} from "@/lib/email/defaultEventBranding";
import { getEventForPublicPage } from "@/lib/db/events";
import {
  internalStaffMealStepConfigured,
  parseInternalStaffMealMenuItems
} from "@/lib/internalStaff/mealMenu";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { cn, formatLocationLine } from "@/lib/utils";

type PageProps = {
  params: { eventId: string; token: string };
};

export default async function InternalStaffMagicCheckInPage({ params }: PageProps) {
  await syncEventStatusForEvent(params.eventId);
  const event = await getEventForPublicPage(params.eventId);
  if (!event) notFound();

  const cancelled = event.status === EventStatus.CANCELLED;
  const completed = event.status === EventStatus.COMPLETED;
  const notOpen = event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE;
  const inviteOnly = !event.allowPublicRegistration;
  const valid =
    event.blueprintTemplate === EventBlueprintTemplate.INTERNAL_STAFF &&
    inviteOnly &&
    event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK &&
    !cancelled &&
    !completed &&
    !notOpen;

  if (!valid) notFound();

  const mealMenuScope = event.internalStaffMealMenuScope ?? InternalStaffMealMenuScope.ALL_STAFF;
  const mealMenuItems = parseInternalStaffMealMenuItems(event.internalStaffMealMenuItems);
  const mealSelectionAtCheckIn = internalStaffMealStepConfigured({
    mealMenuEnabled: event.internalStaffMealMenuEnabled,
    mealMenuScope,
    mealMenuItemsJson: event.internalStaffMealMenuItems,
    mealMenusByBranchJson: event.internalStaffMealMenusByBranch
  });

  const theme = event.attendeeTheme ?? AttendeeTheme.SYSTEM;
  const brandColors = resolveDefaultEventBrandColors(event.org, {
    brandPrimaryColor: event.brandPrimaryColor
  });
  const logoUrl = resolveDefaultEventBrandLogoUrl(event.org, event.brandLogoUrl);
  const isDark = theme === AttendeeTheme.DARK;
  const isLight = theme === AttendeeTheme.LIGHT || theme === AttendeeTheme.SYSTEM;

  const eventDateLabel = new Date(event.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const eventTimeLabel = new Date(event.date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
  const locationLine = formatLocationLine(event.location);

  const introLine =
    event.type === EventType.HYBRID
      ? "This link is for staff connecting online. If you are attending in person, check in at the venue."
      : mealSelectionAtCheckIn
        ? "Confirm your attendance and choose your meal below."
        : "Tap confirm to complete your check-in in one step.";

  return (
    <main
      className={cn(
        "min-h-screen px-4 py-8 sm:px-6 sm:py-12",
        isDark ? "bg-slate-950 text-slate-100" : "bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900"
      )}
      style={
        {
          ["--brand-primary" as string]: brandColors.primary,
          ["--brand-secondary" as string]: brandColors.secondary,
          ["--brand-tertiary" as string]: brandColors.tertiary
        } as Record<string, string>
      }
    >
      <div className="mx-auto w-full max-w-md">
        <div
          className={cn(
            "overflow-hidden rounded-3xl shadow-xl ring-1",
            isDark ? "bg-slate-900 ring-white/10" : "bg-white ring-slate-200/80"
          )}
        >
          <header
            className="relative px-6 pb-8 pt-8 text-white sm:px-8"
            style={{
              background: `linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%)`
            }}
          >
            <div className="flex items-start gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-2xl border-2 border-white/30 bg-white object-cover shadow-md"
                />
              ) : (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-white/30 text-lg font-bold shadow-md"
                  style={{ backgroundColor: brandColors.tertiary, color: brandColors.primary }}
                  aria-hidden
                >
                  {event.org.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("") || "EF"}
                </div>
              )}
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{event.org.name}</p>
                <h1 className="mt-1 text-xl font-bold leading-snug tracking-tight sm:text-2xl">Staff check-in</h1>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-lg font-semibold leading-snug text-white">{event.name}</p>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">{eventDateLabel}</span>
                <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">{eventTimeLabel}</span>
                {locationLine && locationLine !== "Venue TBD" ? (
                  <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">{locationLine}</span>
                ) : null}
              </div>
            </div>
          </header>

          <div className={cn("px-6 py-6 sm:px-8 sm:py-7", isLight && !isDark && "bg-white")}>
            <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>{introLine}</p>

            <div className="mt-6">
              <InternalStaffMagicCheckInClient
                eventId={event.id}
                token={params.token}
                eventType={event.type}
                isDark={isDark}
                brandColors={brandColors}
                zoomJoinUrl={event.zoomJoinUrl}
                virtualCapacity={event.virtualCapacity}
                mealSelectionAtCheckIn={mealSelectionAtCheckIn}
                mealMenuScope={mealMenuScope}
                mealMenuItems={mealMenuItems}
              />
            </div>
          </div>
        </div>

        <p className={cn("mt-6 text-center text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
          Internal staff programme · {event.org.name}
        </p>
      </div>
    </main>
  );
}
