import Link from "next/link";

type DoorDashboardCardProps = {
  eventId: string;
  eventIsLive: boolean;
  isOnsiteEvent: boolean;
};

export function DoorDashboardCard({ eventId, eventIsLive, isOnsiteEvent }: DoorDashboardCardProps) {
  if (!isOnsiteEvent) return null;

  return (
    <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Live door dashboard</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Real-time checked-in count vs venue capacity, recent arrivals, and capacity alerts. Admins receive email at
        80% and 100% full; SMS when mNotify is enabled and org contacts have phone numbers on file.
      </p>
      <Link
        href={`/events/${eventId}/door`}
        className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#0040e0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0035be]"
      >
        {eventIsLive ? "Open live dashboard" : "Preview dashboard"}
      </Link>
    </section>
  );
}
