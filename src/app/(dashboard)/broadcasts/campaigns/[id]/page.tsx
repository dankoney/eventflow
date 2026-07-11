import { Role } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmailCampaignAnalyticsPanel } from "@/components/broadcast/EmailCampaignAnalyticsPanel";
import { EmailCampaignWorkflow } from "@/components/broadcast/EmailCampaignWorkflow";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEmailCampaignAnalyticsForOrg } from "@/lib/db/emailCampaignAnalytics";
import { getEmailCampaignForOrg } from "@/lib/db/emailCampaign";

export default async function EmailCampaignDetailPage({
  params
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  const campaign = await getEmailCampaignForOrg(params.id, session.user.orgId);
  if (!campaign) notFound();

  const analytics = await getEmailCampaignAnalyticsForOrg(params.id, session.user.orgId);

  const liveSendEnabled = process.env.BROADCAST_LIVE_SEND_ENABLED === "true";

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Marketing"
      title={campaign.name}
      description={`Subject: ${campaign.subject}`}
    >
      <div className="mb-4 text-sm">
        <Link href="/broadcasts/campaigns" className="font-medium text-zinc-600 hover:text-zinc-900">
          ← Campaigns
        </Link>
      </div>

      <EmailCampaignWorkflow
        campaignId={campaign.id}
        initialName={campaign.name}
        initialSubject={campaign.subject}
        initialStatus={campaign.status}
        templateName={campaign.template.name}
        liveSendEnabled={liveSendEnabled}
      />

      {analytics ? (
        <div className="mt-10">
          <EmailCampaignAnalyticsPanel analytics={analytics} />
        </div>
      ) : null}
    </WorkspacePageShell>
  );
}
