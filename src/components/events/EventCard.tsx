import Link from "next/link";

import type { EventListItem } from "@/lib/db/events";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

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
};

export function EventCard({ event }: EventCardProps) {
  const { inPerson, virtual } = event.guestSplit;

  return (
    <Link href={`/events/${event.id}`} className="block transition hover:opacity-95">
      <Card className="h-full hover:border-slate-300">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug text-slate-900">{event.name}</h3>
          <Badge className={cn("shrink-0", statusStyles[event.status] ?? "bg-slate-100")}>{event.status}</Badge>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.location}</p>
        <div className="mt-4 space-y-3">
          <CapacityRow label="In-person" used={inPerson} cap={event.capacity} tone="slate" />
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
