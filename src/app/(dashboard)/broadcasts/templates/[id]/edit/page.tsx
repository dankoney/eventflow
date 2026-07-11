import type { JSONContent } from "@tiptap/core";
import { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmailTemplateEditor } from "@/components/broadcast/EmailTemplateEditor";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getEmailTemplateForOrg } from "@/lib/db/emailTemplates";

type EditEmailTemplatePageProps = {
  params: { id: string };
};

export default async function EditEmailTemplatePage({ params }: EditEmailTemplatePageProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  const template = await getEmailTemplateForOrg(params.id, session.user.orgId);
  if (!template) notFound();
  if (template.isPrebuilt) {
    redirect("/broadcasts/templates/new");
  }

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Marketing"
      title={`Edit: ${template.name}`}
      description="Changes are compiled to HTML on save. The unsubscribe link is added automatically."
    >
      <EmailTemplateEditor
        mode="edit"
        templateId={template.id}
        initialName={template.name}
        initialDescription={template.description}
        initialEditorState={template.editorState as JSONContent}
        prebuiltTemplates={[]}
      />
    </WorkspacePageShell>
  );
}
