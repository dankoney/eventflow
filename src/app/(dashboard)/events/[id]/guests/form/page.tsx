import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventRegistrationContactSettingsCard } from "@/components/events/EventRegistrationContactSettingsCard";
import { RegistrationFormBuilderClient } from "@/components/guests/RegistrationFormBuilderClient";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventCustomRegistrationForm } from "@/lib/actions/registrationForm.actions";
import { getEventForUser } from "@/lib/db/events";
import { EventStatus, Role } from "@prisma/client";

type PageProps = { params: { id: string } };

export default async function EventRegistrationFormPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const [res, event] = await Promise.all([
    getEventCustomRegistrationForm(params.id),
    getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role)
  ]);
  if (!res.success || !res.data || !event) redirect(`/events/${params.id}/guests`);

  const contactSettingsLocked =
    event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED;
  const showAdvancedContact = session.user.role === Role.ADMIN;

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Guests"
      title="Custom registration form"
      description="Design field labels and types. Saved on this event for your team and for future public registration wiring."
    >
      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100/50 p-4 shadow-sm sm:p-6">
          <RegistrationFormBuilderClient
            eventId={params.id}
            eventName={res.data.name}
            initial={res.data.form}
          />
        </div>

        {showAdvancedContact ? (
          <details className="group rounded-2xl border border-zinc-200 bg-zinc-50/80">
            <summary className="cursor-pointer list-none px-4 py-4 text-sm font-medium text-zinc-600 marker:content-none sm:px-6">
              <span className="inline-flex items-center gap-2">
                <span className="text-zinc-400 transition group-open:rotate-90">▸</span>
                Advanced registration policies
                <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Admin only
                </span>
              </span>
            </summary>
            <div className="border-t border-zinc-200 px-2 pb-2 pt-2 sm:px-4">
              <EventRegistrationContactSettingsCard
                eventId={event.id}
                readOnly={contactSettingsLocked}
                initialEmailMandatoryForRegistration={event.emailMandatoryForRegistration}
                buried
              />
            </div>
          </details>
        ) : null}
      </div>
    </WorkspacePageShell>
  );
}
