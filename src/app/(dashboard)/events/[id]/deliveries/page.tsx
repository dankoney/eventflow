import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventDeliveryReportPanel } from "@/components/events/EventDeliveryReportPanel";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEventDeliveryReport } from "@/lib/delivery/eventDeliveryReport";
import { getEventForUser } from "@/lib/db/events";
import { canViewEventDeliveryReport } from "@/lib/permissions";

type PageProps = { params: { id: string } };

export default async function EventDeliveriesPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  if (!canViewEventDeliveryReport(session.user.role)) {
    notFound();
  }

  if (
    !(await getEventForUser(
      params.id,
      session.user.orgId,
      session.user.id,
      session.user.role,
      session.sessionId
    ))
  ) {
    notFound();
  }

  const report = await getEventDeliveryReport(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role
  );

  if (!report) notFound();

  return (
    <WorkspacePageShell
      titleLevel="h2"
      kicker="Deliveries"
      title="Email & SMS delivery report"
      description="Track send outcomes, spot failed deliveries, and find guest records that need contact data cleanup."
    >
      <EventDeliveryReportPanel eventId={params.id} report={report} />
    </WorkspacePageShell>
  );
}
