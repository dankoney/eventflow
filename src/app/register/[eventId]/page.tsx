import { notFound } from "next/navigation";
import { EventStatus } from "@prisma/client";

import { PublicRegistrationForm } from "@/components/register/PublicRegistrationForm";
import { getEventForPublicPage } from "@/lib/db/events";
import { formatDate, formatLocationLine } from "@/lib/utils";

type RegisterPageProps = {
  params: { eventId: string };
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const event = await getEventForPublicPage(params.eventId);
  if (!event) notFound();
  const cancelled = event.status === EventStatus.CANCELLED;
  const completed = event.status === EventStatus.COMPLETED;
  const notOpen = event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.LIVE;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{event.name}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {formatDate(event.date)} · {formatLocationLine(event.location)}
      </p>
      <p className="mt-4 text-slate-700">
        {cancelled
          ? "This event has been cancelled by the organizer."
          : completed
            ? "This event has ended."
            : notOpen
              ? "Registration is not open yet."
              : "Complete the form below to register."}
      </p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {cancelled ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            Registration is closed. This event was cancelled; please contact the organizer if you have questions.
          </p>
        ) : completed ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This event is finished and no longer accepts registrations.
          </p>
        ) : notOpen ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Registration opens when the event is published or live.
          </p>
        ) : (
          <PublicRegistrationForm event={event} />
        )}
      </div>
    </main>
  );
}
