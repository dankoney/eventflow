import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventCard } from "@/components/events/EventCard";
import { listEventsWithGuestSplit } from "@/lib/db/events";
import { cn } from "@/lib/utils";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const events = await listEventsWithGuestSplit(session.user.orgId, session.user.id, session.user.role);
  const canCreate = session.user.role === "ADMIN" || session.user.role === "MARKETING";
  const title = session.user.role === "SALES_REP" ? "My events" : "Events";

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {session.user.role === "SALES_REP"
              ? "Events where you have assigned guests."
              : "All events for your organization."}
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/events/new"
            className={cn(
              "inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            )}
          >
            Create event
          </Link>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
          No events yet.
          {canCreate ? (
            <>
              {" "}
              <Link href="/events/new" className="font-medium text-sky-700 underline">
                Create your first event
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
