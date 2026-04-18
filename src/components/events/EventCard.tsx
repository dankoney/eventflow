import Link from "next/link";
import { EventType } from "@prisma/client";
import { Calendar } from "lucide-react";

import type { EventListItem } from "@/lib/db/events";
import { cn, formatDate } from "@/lib/utils";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const typeLabels: Record<EventType, string> = {
  [EventType.IN_PERSON]: "In person",
  [EventType.VIRTUAL]: "Virtual",
  [EventType.HYBRID]: "Hybrid"
};

const typeBadgeStyles: Record<EventType, string> = {
  [EventType.IN_PERSON]: "bg-slate-100 text-slate-800",
  [EventType.VIRTUAL]: "bg-violet-100 text-violet-900",
  [EventType.HYBRID]: "bg-amber-100 text-amber-950"
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800",
  PUBLISHED: "bg-blue-100 text-blue-800",
  LIVE: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-slate-200 text-slate-800",
  CANCELLED: "bg-red-100 text-red-800"
};

function CapacityRow({
  label,
  used,
  cap,
  tone
}: {
  label: string;
  used: number;
  cap: number;
  tone: "slate" | "violet";
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const bar =
    tone === "violet"
      ? "bg-violet-500"
      : "bg-slate-700";

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>
          {used} / {cap}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type EventCardProps = {
  event: EventListItem;
  /** Softer styling for ended events in split lists. */
  variant?: "default" | "past";
};

export function EventCard({ event, variant = "default" }: EventCardProps) {
  const { inPerson, virtual } = event.guestSplit;
  const isPast = variant === "past";

  return (
    <Link href={`/events/${event.id}`} className="block transition hover:opacity-95">
      <Card
        className={cn(
          "h-full transition-colors hover:border-slate-300",
          isPast && "border-slate-100 bg-slate-50/60"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug text-slate-900">{event.name}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge className={cn("shrink-0", typeBadgeStyles[event.type] ?? "bg-slate-100")}>
              {typeLabels[event.type]}
            </Badge>
            <Badge className={cn("shrink-0 text-[10px] font-medium", statusStyles[event.status] ?? "bg-slate-100")}>
              {event.status}
            </Badge>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <time dateTime={event.date.toISOString()}>{formatDate(event.date)}</time>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.locationSummary}</p>
        <div className="mt-4 space-y-3">
          {event.type === EventType.VIRTUAL ? (
            <p className="text-xs text-slate-500">In-person: not offered</p>
          ) : (
            <CapacityRow label="In-person" used={inPerson} cap={event.capacity} tone="slate" />
          )}
          {event.virtualCapacity > 0 ? (
            <CapacityRow label="Virtual" used={virtual} cap={event.virtualCapacity} tone="violet" />
          ) : (
            <p className="text-xs text-slate-500">Virtual: not enabled</p>
          )}
        </div>
      </Card>
    </Link>
  );
}
