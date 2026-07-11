import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { ensureOrgPrebuiltEmailTemplates, listEmailTemplatesForOrg } from "@/lib/db/emailTemplates";
import { formatDate } from "@/lib/utils";

export default async function EmailTemplatesPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  await ensureOrgPrebuiltEmailTemplates(session.user.orgId, session.user.id);
  const templates = await listEmailTemplatesForOrg(session.user.orgId);
  const customTemplates = templates.filter((t) => !t.isPrebuilt);

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Marketing"
      title="Email templates"
      description="Design broadcast emails with the Maily editor. Starter templates are read-only — copy them into your own template to customize."
      headerActions={
        <Link
          href="/broadcasts/templates/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          New template
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/broadcasts" className="font-medium text-zinc-600 hover:text-zinc-900">
          ← Segments
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">Type</th>
              <th className="hidden px-4 py-3 font-semibold sm:table-cell">Updated</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {customTemplates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                  No custom templates yet.{" "}
                  <Link href="/broadcasts/templates/new" className="font-medium text-indigo-700 hover:underline">
                    Create one
                  </Link>{" "}
                  from a starter or blank canvas.
                </td>
              </tr>
            ) : (
              customTemplates.map((template) => (
                <tr key={template.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{template.name}</p>
                    {template.description ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{template.description}</p>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">Custom</td>
                  <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell">
                    {formatDate(template.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/broadcasts/templates/${template.id}/edit`}
                      className="text-sm font-medium text-indigo-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        {templates.filter((t) => t.isPrebuilt).length} starter template
        {templates.filter((t) => t.isPrebuilt).length === 1 ? "" : "s"} available when creating a new
        template.
      </p>
    </WorkspacePageShell>
  );
}
