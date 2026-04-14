import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventForm } from "@/components/events/EventForm";

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "SALES_REP") {
    redirect("/events");
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create event</h1>
      <p className="mt-1 text-sm text-slate-600">
        Add event details. Virtual capacity creates a Zoom webinar and stores join details on the event.
      </p>
      <div className="mt-8">
        <EventForm />
      </div>
    </section>
  );
}
