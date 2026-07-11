import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmailTemplateEditor } from "@/components/broadcast/EmailTemplateEditor";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { ensureOrgPrebuiltEmailTemplates, listPrebuiltEmailTemplates } from "@/lib/db/emailTemplates";

export default async function NewEmailTemplatePage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  await ensureOrgPrebuiltEmailTemplates(session.user.orgId, session.user.id);
  const prebuiltTemplates = await listPrebuiltEmailTemplates(session.user.orgId);

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Marketing"
      title="New email template"
      description="Choose a starter design or begin with a blank canvas, then customize with merge tags."
    >
      <EmailTemplateEditor mode="create" prebuiltTemplates={prebuiltTemplates} />
    </WorkspacePageShell>
  );
}
