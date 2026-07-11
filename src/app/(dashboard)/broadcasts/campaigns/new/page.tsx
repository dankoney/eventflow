import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmailCampaignCreateForm } from "@/components/broadcast/EmailCampaignCreateForm";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import {
  listBroadcastEventOptions,
  listBroadcastSegmentFilterOptions
} from "@/lib/db/emailBroadcast";
import { ensureOrgPrebuiltEmailTemplates, listEmailTemplatesForOrg } from "@/lib/db/emailTemplates";

export default async function NewEmailCampaignPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  const orgId = session.user.orgId;

  await ensureOrgPrebuiltEmailTemplates(orgId, session.user.id);

  const [events, initialFilterOptions, templates] = await Promise.all([
    listBroadcastEventOptions(orgId),
    listBroadcastSegmentFilterOptions(orgId, null),
    listEmailTemplatesForOrg(orgId)
  ]);

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Marketing"
      title="New campaign"
      description="Pick a template and audience. The segment is re-resolved at send time."
    >
      <div className="mb-4 text-sm">
        <Link href="/broadcasts/campaigns" className="font-medium text-zinc-600 hover:text-zinc-900">
          ← Campaigns
        </Link>
      </div>

      <EmailCampaignCreateForm
        orgId={orgId}
        events={events}
        initialFilterOptions={initialFilterOptions}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          isPrebuilt: t.isPrebuilt
        }))}
      />
    </WorkspacePageShell>
  );
}
