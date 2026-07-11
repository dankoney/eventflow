import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BroadcastSegmentBuilder } from "@/components/broadcast/BroadcastSegmentBuilder";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import {
  listBroadcastEventOptions,
  listBroadcastSegmentFilterOptions
} from "@/lib/db/emailBroadcast";

export default async function BroadcastsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  const orgId = session.user.orgId;

  const [events, initialFilterOptions] = await Promise.all([
    listBroadcastEventOptions(orgId),
    listBroadcastSegmentFilterOptions(orgId, null)
  ]);

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Marketing"
      title="Broadcast segments"
      description="Define who receives marketing email from your guest and CRM data. Recipients must be subscribed; counts update live as you adjust filters."
    >
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <Link href="/broadcasts/templates" className="font-medium text-indigo-700 hover:underline">
          Email templates →
        </Link>
        <Link href="/broadcasts/campaigns" className="font-medium text-indigo-700 hover:underline">
          Campaigns →
        </Link>
      </div>
      <BroadcastSegmentBuilder
        orgId={orgId}
        events={events}
        initialFilterOptions={initialFilterOptions}
      />
    </WorkspacePageShell>
  );
}
