import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventCard } from "@/components/events/EventCard";
import {
  listEventsWithGuestSplit,
  partitionEventsForTabs,
  resolveEventsListTab,
  type EventsListTabId
} from "@/lib/db/events";
import { isRepScopedRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type EventsPageProps = {
  searchParams?: { tab?: string };
};

const TAB_CONFIG: { id: EventsListTabId; label: string }[] = [
  { id: "ongoing", label: "Ongoing" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" }
];

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const events = await listEventsWithGuestSplit(session.user.orgId, session.user.id, session.user.role);
  const canCreate = session.user.role === "ADMIN" || session.user.role === "MARKETING";
  const title = isRepScopedRole(session.user.role) ? "My events" : "Events";
  const now = new Date();
  const { ongoing, upcoming, past } = partitionEventsForTabs(events, now);
  const counts = { ongoing: ongoing.length, upcoming: upcoming.length, past: past.length };
  const activeTab = resolveEventsListTab(searchParams?.tab, counts);

  const tabLists: Record<EventsListTabId, typeof events> = {
    ongoing,
    upcoming,
    past
  };
  const activeList = tabLists[activeTab];

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            {isRepScopedRole(session.user.role)
              ? "Events in your organization. Guest lists mask other reps’ contact details unless a guest is assigned to you."
              : "Create and manage events for your organization. Newest activity appears first."}
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/events/new"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            )}
          >
            Create event
          </Link>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-slate-600">No events yet.</p>
          {canCreate ? (
            <p className="mt-3 text-sm">
              <Link href="/events/new" className="font-medium text-sky-700 underline underline-offset-2">
                Create your first event
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <nav
            className="mt-8 flex flex-wrap gap-1 border-b border-slate-200"
            aria-label="Filter events by phase"
          >
            {TAB_CONFIG.map(({ id, label }) => {
              const count = counts[id];
              const isActive = activeTab === id;
              return (
                <Link
                  key={id}
                  href={`/events?tab=${id}`}
                  scroll={false}
                  className={cn(
                    "relative -mb-px inline-flex items-center gap-2 rounded-t-md px-3 py-2.5 text-sm font-medium transition sm:px-4",
                    isActive
                      ? "border-b-2 border-slate-900 text-slate-900"
                      : "border-b-2 border-transparent text-slate-600 hover:border-slate-200 hover:text-slate-900"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {label}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs tabular-nums",
                      isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6">
            {activeList.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-6 py-12 text-center text-sm text-slate-600">
                No events in <span className="font-medium text-slate-800">{TAB_CONFIG.find((t) => t.id === activeTab)?.label}</span>.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeList.map((event) => (
                  <EventCard key={event.id} event={event} variant={activeTab === "past" ? "past" : "default"} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
