import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventForm } from "@/components/events/EventForm";
import { listLocationsForOrg } from "@/lib/db/locations";

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MARKETING") {
    redirect("/events");
  }

  const locations = await listLocationsForOrg(session.user.orgId);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create event</h1>
      <p className="mt-1 text-sm text-slate-600">
        Add event details. Virtual capacity creates a Zoom webinar or meeting and stores join details on the event.
      </p>
      <div className="mt-8">
        <EventForm mode="create" locations={locations} />
      </div>
    </section>
  );
}
