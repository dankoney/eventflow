import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventsCatalog } from "@/components/events/EventsCatalog";
import {
  listEventsWithGuestSplit,
  partitionEventsForTabs,
  resolveEventsListTab
} from "@/lib/db/events";
import { syncEventStatuses } from "@/lib/lifecycle/syncEventStatuses";
import { isEventLinkedRole, isSalesRepRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type EventsPageProps = {
  searchParams?: { tab?: string };
};

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await syncEventStatuses();
  const events = await listEventsWithGuestSplit(session.user.orgId, session.user.id, session.user.role);
  const canCreate = session.user.role === "ADMIN" || session.user.role === "MARKETING";
  const title = isEventLinkedRole(session.user.role) ? "My events" : "Events";
  const now = new Date();
  const { ongoing, upcoming, past } = partitionEventsForTabs(events, now);
  const counts = { ongoing: ongoing.length, upcoming: upcoming.length, past: past.length };
  const activeTab = resolveEventsListTab(searchParams?.tab, counts);

  const tabLists: Record<"ongoing" | "upcoming" | "past", typeof events> = {
    ongoing,
    upcoming,
    past
  };
  const activeList = tabLists[activeTab];

  const subtitle = isSalesRepRole(session.user.role)
    ? "Events linked to you. Guest lists mask other reps’ contact details unless a guest is assigned to you or PII override is active."
    : isEventLinkedRole(session.user.role)
      ? "Events you are assigned to operate on event day."
      : "Create and manage events for your organization. Newest activity appears first.";

  return (
    <section className="mx-auto w-full max-w-7xl pb-12">
      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-gradient-to-br from-zinc-50 to-white px-6 py-16 text-center shadow-sm ring-1 ring-zinc-900/[0.03]">
          <p className="text-sm font-medium text-zinc-700">No events yet</p>
          <p className="mt-2 text-sm text-zinc-600">When you create an event, it will show up here with imagery, capacity, and attendance at a glance.</p>
          {canCreate ? (
            <Link
              href="/events/new"
              className={cn(
                "mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                "bg-zinc-900 hover:bg-zinc-800"
              )}
            >
              Create your first event
            </Link>
          ) : null}
        </div>
      ) : (
        <EventsCatalog
          activeTab={activeTab}
          counts={counts}
          activeList={activeList}
          canCreate={canCreate}
          title={title}
          subtitle={subtitle}
        />
      )}
    </section>
  );
}
