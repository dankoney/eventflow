"use client";

import Link from "next/link";
import { EventBlueprintTemplate, EventScheduleMode, EventType } from "@prisma/client";
import { Building2, Calendar, MapPin, Monitor, MoreVertical, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { EventListItem } from "@/lib/db/events";
import { eventCardTitleClasses } from "@/lib/ui/eventHeroTitle";
import { heroGradientFromId } from "@/lib/ui/heroGradientFromId";
import { cn, coerceDate, formatDate } from "@/lib/utils";

const typeLabels: Record<EventType, string> = {
  [EventType.IN_PERSON]: "In person",
  [EventType.VIRTUAL]: "Virtual only",
  [EventType.HYBRID]: "Hybrid"
};

const statusBadgeClass: Record<string, string> = {
  DRAFT: "bg-amber-400/95 text-amber-950 ring-1 ring-amber-500/30",
  PUBLISHED: "bg-sky-500/95 text-white ring-1 ring-sky-600/40",
  LIVE: "bg-zinc-900/95 text-white ring-1 ring-zinc-950/40",
  COMPLETED: "bg-zinc-500/95 text-white ring-1 ring-zinc-700/30",
  CANCELLED: "bg-red-600/95 text-white ring-1 ring-red-800/30"
};

const blueprintLabels: Record<EventBlueprintTemplate, string> = {
  [EventBlueprintTemplate.BLANK]: "Blank",
  [EventBlueprintTemplate.CONFERENCE]: "Conference",
  [EventBlueprintTemplate.INTERNAL_STAFF]: "Internal staff",
  [EventBlueprintTemplate.TRAINING_WORKSHOP]: "Training / workshop"
};

const blueprintBadgeClass: Record<EventBlueprintTemplate, string> = {
  [EventBlueprintTemplate.BLANK]: "bg-zinc-800/95 text-white ring-1 ring-white/20",
  [EventBlueprintTemplate.CONFERENCE]: "bg-sky-600/95 text-white ring-1 ring-sky-300/25",
  [EventBlueprintTemplate.INTERNAL_STAFF]: "bg-violet-600/95 text-white ring-1 ring-violet-300/25",
  [EventBlueprintTemplate.TRAINING_WORKSHOP]: "bg-emerald-600/95 text-white ring-1 ring-emerald-300/25"
};

function registrationMetrics(event: EventListItem) {
  const { inPerson, virtual } = event.guestSplit;
  const registered = inPerson + virtual;
  let cap = 0;
  if (event.type === EventType.IN_PERSON) cap = event.capacity;
  else if (event.type === EventType.VIRTUAL) cap = event.virtualCapacity;
  else cap = event.capacity + event.virtualCapacity;
  const pct = cap > 0 ? Math.min(100, Math.round((registered / cap) * 100)) : 0;
  return { registered, cap, pct };
}

function TypeCornerBadge({ type }: { type: EventType }) {
  const Icon = type === EventType.VIRTUAL ? Monitor : type === EventType.HYBRID ? Building2 : Users;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/15 backdrop-blur-sm">
      <Icon className="h-3 w-3 opacity-90" aria-hidden />
      {typeLabels[type]}
    </span>
  );
}

function EventCardCreatorLine({ name }: { name: string | null }) {
  if (!name) {
    return <span className="min-w-0 flex-1" aria-hidden />;
  }
  return (
    <p className="min-w-0 truncate text-[11px] text-zinc-500">
      Created by <span className="font-medium text-zinc-700">{name}</span>
    </p>
  );
}

function EventCardActions({
  eventId,
  canManage,
  menuPlacement = "up"
}: {
  eventId: string;
  canManage: boolean;
  menuPlacement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cn(
          "rounded-lg p-2 text-zinc-500 ring-1 ring-zinc-200/80 transition",
          "hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Event actions"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 z-30 min-w-[160px] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg ring-1 ring-black/5",
            menuPlacement === "up" ? "bottom-full mb-1" : "top-full mt-1"
          )}
          role="menu"
        >
          <Link
            href={`/events/${eventId}`}
            role="menuitem"
            className="block px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            onClick={() => setOpen(false)}
          >
            View event
          </Link>
          {canManage ? (
            <Link
              href={`/events/${eventId}/edit`}
              role="menuitem"
              className="block px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => setOpen(false)}
            >
              Edit event
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type EventCardLayout = "grid" | "list";

type EventCardProps = {
  event: EventListItem;
  variant?: "default" | "past";
  layout?: EventCardLayout;
  canManage?: boolean;
};

export function EventCard({ event, variant = "default", layout = "grid", canManage = false }: EventCardProps) {
  const { inPerson, virtual } = event.guestSplit;
  const isPast = variant === "past";
  const heroSrc = event.bannerImageUrl || event.facilityImageUrl || null;
  const { pct, registered, cap } = registrationMetrics(event);
  const barTone = isPast ? "bg-zinc-300" : "bg-zinc-900";

  const metaLine = (
    <>
      <span className="inline-flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
        <time dateTime={coerceDate(event.date).toISOString()}>{formatDate(event.date)}</time>
      </span>
      <span className="hidden sm:inline text-zinc-300" aria-hidden>
        ·
      </span>
      <span className="inline-flex min-w-0 items-start gap-1.5 sm:inline-flex">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
        <span className="line-clamp-2">{event.locationSummary}</span>
      </span>
    </>
  );

  const capacityBlock = (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Registration capacity</span>
        <span className="text-xs font-bold tabular-nums text-zinc-700">{cap > 0 ? `${pct}%` : "—"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/60">
        <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${cap > 0 ? pct : 0}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        {cap > 0 ? `${registered} registered · cap ${cap}` : "Capacity not set for this format"}
      </p>
    </div>
  );

  const attendanceRow = (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        layout === "list" ? "" : "border-t border-zinc-100 pt-3"
      )}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">In person</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{inPerson}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Virtual</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{virtual}</p>
      </div>
    </div>
  );

  const blueprint = (
    <p className="text-[11px] font-medium text-zinc-500">
      Template: {blueprintLabels[event.blueprintTemplate]}
    </p>
  );

  const cardTitle = eventCardTitleClasses(event.name);

  function EventHero({ frameClass }: { frameClass: string }) {
    return (
      <div className={cn("relative overflow-hidden bg-zinc-200", frameClass)}>
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary org URLs
          <img src={heroSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="absolute inset-0 flex min-h-0 items-center justify-center p-3 sm:p-4"
            style={{ background: heroGradientFromId(event.id) }}
          >
            <h3
              className={cn(
                "w-full text-balance text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]",
                cardTitle.title
              )}
            >
              {event.name}
            </h3>
          </div>
        )}
        {heroSrc ? (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        ) : null}
        <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm",
              statusBadgeClass[event.status] ?? "bg-zinc-700 text-white"
            )}
          >
            {event.status.replace(/_/g, " ")}
          </span>
          {event.scheduleMode === EventScheduleMode.MULTI_DAY ? (
            <span className="rounded-md bg-zinc-800/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/20">
              Multi-day
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              blueprintBadgeClass[event.blueprintTemplate]
            )}
          >
            {blueprintLabels[event.blueprintTemplate]}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 z-20">
          <TypeCornerBadge type={event.type} />
        </div>
      </div>
    );
  }

  if (layout === "list") {
    return (
      <div className="relative flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md">
        <Link href={`/events/${event.id}`} className="flex min-w-0 flex-1 flex-col sm:flex-row">
          <div className="relative h-36 w-full shrink-0 sm:hidden">
            <EventHero frameClass="h-full w-full" />
          </div>
          <div className="relative hidden w-52 shrink-0 self-stretch sm:block">
            <EventHero frameClass="absolute inset-0 h-full min-h-[148px] w-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4 py-4">
            <div>
              {heroSrc ? <h3 className="text-lg font-semibold leading-snug text-zinc-900">{event.name}</h3> : null}
              {blueprint}
            </div>
            <div className="flex flex-col gap-1 text-xs text-zinc-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
              {metaLine}
            </div>
            <div className="grid gap-4 pt-1 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div className="min-w-0">{capacityBlock}</div>
              <div className="min-w-0">{attendanceRow}</div>
            </div>
            {event.createdByName ? (
              <div className="border-t border-zinc-100 pt-2">
                <EventCardCreatorLine name={event.createdByName} />
              </div>
            ) : null}
          </div>
        </Link>
        <div className="flex shrink-0 items-start border-l border-zinc-100 bg-zinc-50/50 px-2 py-3">
          <EventCardActions eventId={event.id} canManage={canManage} menuPlacement="down" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md">
      <Link href={`/events/${event.id}`} className="flex min-h-0 flex-1 flex-col">
        <EventHero frameClass="aspect-[16/10] w-full shrink-0" />
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            {heroSrc ? <h3 className="text-lg font-semibold leading-snug text-zinc-900">{event.name}</h3> : null}
            {blueprint}
          </div>
          <div className="flex flex-col gap-1 text-xs text-zinc-600">{metaLine}</div>
          {capacityBlock}
          {attendanceRow}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/50 px-3 py-2">
        <EventCardCreatorLine name={event.createdByName} />
        <EventCardActions eventId={event.id} canManage={canManage} />
      </div>
    </div>
  );
}
