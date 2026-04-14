import { notFound } from "next/navigation";

import { PublicRegistrationForm } from "@/components/register/PublicRegistrationForm";
import { getEventForPublicRegistration } from "@/lib/db/events";
import { formatDate } from "@/lib/utils";

type RegisterPageProps = {
  params: { eventId: string };
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const event = await getEventForPublicRegistration(params.eventId);
  if (!event) notFound();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{event.name}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {formatDate(event.date)} · {event.location}
      </p>
      <p className="mt-4 text-slate-700">Complete the form below to register.</p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <PublicRegistrationForm event={event} />
      </div>
    </main>
  );
}
