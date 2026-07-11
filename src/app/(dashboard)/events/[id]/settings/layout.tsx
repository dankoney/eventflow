import { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventSettingsSubnav } from "@/components/events/EventSettingsSubnav";
import { getEventForUser } from "@/lib/db/events";
import { canManageEventTeam } from "@/lib/permissions";

type SettingsLayoutProps = {
  children: ReactNode;
  params: { id: string };
};

export default async function EventSettingsLayout({ children, params }: SettingsLayoutProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (!canManageEventTeam(session.user.role)) redirect(`/events/${params.id}`);

  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role,
    session.sessionId
  );
  if (!event) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <EventSettingsSubnav eventId={params.id} />
      {children}
    </div>
  );
}
