import { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventDetailTabs } from "@/components/events/EventDetailTabs";
import { getEventForUser } from "@/lib/db/events";
import { formatDate, formatLocationLine } from "@/lib/utils";

type EventLayoutProps = {
  children: ReactNode;
  params: { id: string };
};

export default async function EventDetailLayout({ children, params }: EventLayoutProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const event = await getEventForUser(params.id, session.user.orgId, session.user.id, session.user.role);
  if (!event) return notFound();

  const canEdit = session.user.role === "ADMIN" || session.user.role === "MARKETING";

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{event.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {formatDate(event.date)}
          {` · ${formatLocationLine(event.location)}`}
        </p>
      </div>
      <EventDetailTabs eventId={event.id} canEdit={canEdit} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
