import {
  EventBlueprintTemplate,
  EventScheduleMode,
  EventStatus,
  EventType,
  Role,
  ZoomSessionKind,
} from "@prisma/client";
import { CalendarRange, MapPin, Radio, Users, Video } from "lucide-react";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CommandCenterUrlCard } from "@/components/events/CommandCenterUrlCard";
import { EventLifecyclePanel } from "@/components/events/EventLifecyclePanel";
import { RegistrationLinkSection } from "@/components/events/RegistrationLinkSection";
import { EventLiveOpsPanel } from "@/components/events/EventLiveOpsPanel";
import { EventZoomPasscodeRefreshButton } from "@/components/events/EventZoomPasscodeRefreshButton";
import { ZoomMeetingDetailsShare } from "@/components/events/ZoomMeetingDetailsShare";
import { Badge } from "@/components/ui/Badge";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventForUser } from "@/lib/db/events";
import { parseMultiDayConfig } from "@/lib/event-schedule/multiDayConfig";
import { syncEventStatusForEvent } from "@/lib/lifecycle/syncEventStatuses";
import { isWalkInBoothOpen, walkInBoothStatusMessage } from "@/lib/checkin/walkInBoothWindow";
import { getEventWalkInCheckInBoothUrl, getOrgCommandCenterUrl, getPublicSiteUrl } from "@/lib/url";
import { cn, formatDate, formatLocationLine } from "@/lib/utils";

const statusLabel: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const typeLabel: Record<EventType, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid",
};

const blueprintLabel: Record<EventBlueprintTemplate, string> = {
  BLANK: "Blank",
  CONFERENCE: "Conference",
  INTERNAL_STAFF: "Internal staff",
  TRAINING_WORKSHOP: "Training / workshop"
};

function statusBadgeClass(status: EventStatus): string {
  switch (status) {
    case EventStatus.DRAFT:
      return "bg-amber-400/95 text-amber-950 ring-1 ring-amber-500/30";
    case EventStatus.PUBLISHED:
      return "bg-sky-500/95 text-white ring-1 ring-sky-600/40";
    case EventStatus.LIVE:
      return "bg-zinc-900/95 text-white ring-1 ring-zinc-950/40";
    case EventStatus.COMPLETED:
      return "bg-zinc-500/95 text-white ring-1 ring-zinc-700/30";
    case EventStatus.CANCELLED:
      return "bg-red-600/95 text-white ring-1 ring-red-800/30";
  }
}

function pct(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

type PageProps = { params: { id: string } };

export default async function EventOverviewPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.orgId) notFound();

  await syncEventStatusForEvent(params.id);

  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role,
    session.sessionId
  );
  if (!event) notFound();

  const inPersonCount = event.guests.filter(
    (g) => g.mode === "IN_PERSON",
  ).length;
  const virtualCount = event.guests.filter((g) => g.mode === "VIRTUAL").length;

  const baseUrl = getPublicSiteUrl();
  const registrationUrl = `${baseUrl}/register/${event.id}`;
  const commandCenterUrl = getOrgCommandCenterUrl(event.org.slug);
  const checkInBoothUrl = getEventWalkInCheckInBoothUrl(event.org.slug, event.id);
  const isOnsiteEvent = event.type !== EventType.VIRTUAL;
  const eventIsLive = event.status === EventStatus.LIVE;
  const boothOpen = isWalkInBoothOpen({
    date: event.date,
    endDate: event.endDate,
    status: event.status,
    type: event.type
  });
  const boothStatusMessage = walkInBoothStatusMessage({
    date: event.date,
    endDate: event.endDate,
    status: event.status,
    type: event.type
  });
  const canPublish =
    session.user.role === "ADMIN" || session.user.role === "MARKETING";
  const canHostZoom = session.user.role === Role.ADMIN;
  const hasZoomRoom =
    event.virtualCapacity > 0 && Boolean(event.zoomMeetingId && event.zoomJoinUrl);
  const effectiveEnd = event.endDate;
  const guestTotal = event.guests.length;
  const isPublishedOrLive =
    event.status === EventStatus.PUBLISHED || event.status === EventStatus.LIVE;
  const canDeleteEvent =
    !isPublishedOrLive &&
    (event.status === EventStatus.DRAFT ||
      guestTotal === 0 ||
      effectiveEnd.getTime() <= Date.now() ||
      event.status === EventStatus.CANCELLED);
  const scheduledEndHasPassed = event.endDate.getTime() <= Date.now();
  const multiDay = parseMultiDayConfig(event.multiDayConfig);

  const inPersonPct = pct(inPersonCount, event.capacity);
  const virtualPct =
    event.virtualCapacity > 0 ? pct(virtualCount, event.virtualCapacity) : 0;

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Event workspace"
      title="Overview"
      description="Specification, capacity, broadcast links, and lifecycle controls for this run — grouped in the same workspace frame as the events list."
    >
      <div className="space-y-10">
        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
          <div className="min-w-0 space-y-10 lg:col-span-8">
            {canPublish ? (
              <EventLifecyclePanel
                eventId={event.id}
                status={event.status}
                canManage={canPublish}
                canDeleteEvent={canDeleteEvent}
                scheduledEndHasPassed={scheduledEndHasPassed}
              />
            ) : (
              <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-5 sm:px-6">
                <p className="text-sm font-medium text-zinc-800">Team view</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Lifecycle controls are limited to admin and marketing roles.
                  You can still browse guests, check-in, and analytics from the
                  tabs above.
                </p>
              </section>
            )}

            <article className="space-y-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <header className="border-b border-zinc-100 bg-zinc-50 px-4 py-4 sm:px-6 sm:py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Event specification
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                    Details & capacity
                  </h2>
                  <Badge className={cn(statusBadgeClass(event.status))}>
                    {statusLabel[event.status]}
                  </Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                  One place for classification, schedule, room limits, and
                  broadcast links — formatted like an internal brief, not a
                  generic form.
                </p>
              </header>

              <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-zinc-100">
                <section className="p-4 sm:p-6" aria-labelledby="spec-details">
                  <h3
                    id="spec-details"
                    className="text-xs font-bold uppercase tracking-wide text-zinc-500"
                  >
                    Program
                  </h3>
                  <dl className="mt-4 space-y-4 text-sm">
                    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-4">
                      <dt className="text-zinc-500">Format</dt>
                      <dd className="text-right font-semibold text-zinc-900">
                        {typeLabel[event.type]}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-4">
                      <dt className="text-zinc-500">Template</dt>
                      <dd className="text-right font-semibold text-zinc-900">
                        {blueprintLabel[event.blueprintTemplate]}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-4">
                      <dt className="text-zinc-500">Starts</dt>
                      <dd className="max-w-[55%] text-right text-zinc-900">
                        {formatDate(event.date)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-4">
                      <dt className="text-zinc-500">Ends</dt>
                      <dd className="max-w-[55%] text-right text-zinc-900">
                        {formatDate(event.endDate)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 pb-1">
                      <dt className="flex items-center gap-2 text-zinc-500">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        Venue
                      </dt>
                      <dd className="max-w-[60%] text-right font-medium leading-snug text-zinc-900">
                        {formatLocationLine(event.location)}
                      </dd>
                    </div>
                    {event.description ? (
                      <div className="border-t border-zinc-100 pt-4">
                        <dt className="text-zinc-500">Description</dt>
                        <dd className="mt-2 leading-relaxed text-zinc-700">
                          {event.description}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                <section
                  className="border-t border-zinc-100 p-4 sm:border-t-0 sm:p-6"
                  aria-labelledby="spec-ops"
                >
                  <h3
                    id="spec-ops"
                    className="text-xs font-bold uppercase tracking-wide text-zinc-500"
                  >
                    Operations
                  </h3>
                  <div className="mt-4 space-y-5">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-900">
                          In person
                        </span>
                        <span className="tabular-nums text-sm text-zinc-600">
                          <span className="font-bold text-zinc-900">
                            {inPersonCount}
                          </span>
                          <span className="text-zinc-400"> / </span>
                          {event.capacity}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-zinc-900 to-zinc-600"
                          style={{ width: `${inPersonPct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {inPersonPct}% of in-person seats claimed
                      </p>
                    </div>

                    {event.virtualCapacity > 0 ? (
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                            <Video
                              className="h-4 w-4 text-zinc-500"
                              aria-hidden
                            />
                            Virtual
                          </span>
                          <span className="tabular-nums text-sm text-zinc-600">
                            <span className="font-bold text-zinc-900">
                              {virtualCount}
                            </span>
                            <span className="text-zinc-400"> / </span>
                            {event.virtualCapacity}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/80">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-zinc-800 to-zinc-600"
                            style={{ width: `${virtualPct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {virtualPct}% of virtual seats claimed
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                        Virtual capacity is set to zero — this run is in-room
                        only.
                      </p>
                    )}
                  </div>

                  {event.virtualCapacity > 0 &&
                  (event.zoomJoinUrl || event.zoomMeetingId) ? (
                    <div className="mt-6 border-t border-zinc-100 pt-5">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-zinc-700" aria-hidden />
                        <h4 className="text-sm font-bold text-zinc-900">
                          Zoom{" "}
                          {event.zoomSessionKind === ZoomSessionKind.MEETING
                            ? "meeting"
                            : "webinar"}
                        </h4>
                      </div>
                      <dl className="mt-3 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm">
                        {event.zoomMeetingId ? (
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                              Meeting ID
                            </dt>
                            <dd className="mt-0.5 font-mono text-zinc-900">
                              {event.zoomMeetingId}
                            </dd>
                          </div>
                        ) : null}
                        {event.zoomPasscode ? (
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                              Passcode
                            </dt>
                            <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-zinc-900">
                              <span>{event.zoomPasscode}</span>
                              <EventZoomPasscodeRefreshButton
                                eventId={event.id}
                                canManage={canPublish}
                              />
                            </dd>
                          </div>
                        ) : null}
                        {event.zoomJoinUrl ? (
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                              Join URL
                            </dt>
                            <dd className="mt-2 text-zinc-900">
                              <ZoomMeetingDetailsShare
                                eventName={event.name}
                                sessionLabel={
                                  event.zoomSessionKind ===
                                  ZoomSessionKind.MEETING
                                    ? "meeting"
                                    : "webinar"
                                }
                                meetingId={event.zoomMeetingId}
                                passcode={event.zoomPasscode}
                                joinUrl={event.zoomJoinUrl}
                              />
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ) : null}
                </section>
              </div>
            </article>
          </div>

          <aside className="mt-10 space-y-5 lg:col-span-4 lg:mt-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Users className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    Guests
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
                  {guestTotal}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    Room
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
                  {inPersonPct}%
                </p>
                <p className="text-[10px] text-zinc-500">in person fill</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Video className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    Stream
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
                  {event.virtualCapacity > 0 ? `${virtualPct}%` : "—"}
                </p>
                <p className="text-[10px] text-zinc-500">virtual fill</p>
              </div>
            </div>

            <RegistrationLinkSection
              eventId={event.id}
              status={event.status}
              registrationUrl={registrationUrl}
              canPublish={canPublish}
              layout="rail"
            />
            <EventLiveOpsPanel
              eventId={event.id}
              commandCenterUrl={commandCenterUrl}
              checkInBoothUrl={checkInBoothUrl}
              orgSlug={event.org.slug}
              allowFlashEntry={event.allowFlashEntry}
              eventIsLive={eventIsLive}
              boothOpen={boothOpen}
              boothStatusMessage={boothStatusMessage}
              isOnsiteEvent={isOnsiteEvent}
              canHostZoom={canHostZoom}
              hasZoomRoom={hasZoomRoom}
              zoomStartUrl={event.zoomStartUrl}
              zoomJoinUrl={event.zoomJoinUrl}
            />
          </aside>
        </div>

        {event.scheduleMode === EventScheduleMode.MULTI_DAY && multiDay ? (
          <section
            className="overflow-hidden rounded-2xl border-2 border-zinc-900 bg-zinc-950 text-zinc-100 shadow-[10px_10px_0_0_rgb(24_24_27)]"
            aria-labelledby="multiday-heading"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-4 py-5 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <CalendarRange
                    className="h-5 w-5 text-amber-300"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <h2
                    id="multiday-heading"
                    className="text-lg font-bold tracking-tight"
                  >
                    Multi-day runway
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                    <span className="text-zinc-200">Registration:</span>{" "}
                    {multiDay.registrationPolicy === "FIRST_DAY_ONLY"
                      ? "Self-serve only through day 1 session end."
                      : "Open until the event ends."}{" "}
                    <span className="text-zinc-600">·</span>{" "}
                    <span className="text-zinc-200">Check-in:</span>{" "}
                    {multiDay.checkInPolicy === "EACH_DAY"
                      ? "Each session day."
                      : "Once for the whole event."}{" "}
                    <span className="text-zinc-600">·</span>{" "}
                    <span className="text-zinc-200">Virtual links:</span>{" "}
                    {multiDay.virtualLinkMode === "PER_DAY"
                      ? "Different URL per day."
                      : "Shared Zoom for all days."}
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
              <ol className="flex min-w-max gap-4 pb-1">
                {[...multiDay.days]
                  .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
                  .map((d, idx, arr) => (
                    <li
                      key={d.dayIndex}
                      className="relative flex w-[min(100vw-3rem,280px)] shrink-0 flex-col"
                    >
                      {idx < arr.length - 1 ? (
                        <div
                          className="absolute left-[calc(100%+0.5rem)] top-8 hidden h-0.5 w-4 bg-gradient-to-r from-amber-400/80 to-transparent sm:block"
                          aria-hidden
                        />
                      ) : null}
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 ring-1 ring-white/10">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">
                          Session day
                        </p>
                        <p className="mt-2 text-2xl font-black tabular-nums text-white">
                          Day {d.dayIndex}
                        </p>
                        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                          {formatDate(d.startsAt)}
                          <span className="mx-1 text-zinc-600">→</span>
                          {formatDate(d.endsAt)}
                        </p>
                      </div>
                    </li>
                  ))}
              </ol>
            </div>
          </section>
        ) : null}
      </div>
    </WorkspacePageShell>
  );
}
