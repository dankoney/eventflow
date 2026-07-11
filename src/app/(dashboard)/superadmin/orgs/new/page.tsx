import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";

import { ProvisionOrgForm } from "./ProvisionOrgForm";

export const dynamic = "force-dynamic";

/**
 * Platform-owner-only form to create a brand new workspace and its first admin
 * user. The actual mutation happens in {@link provisionOrganization}; this
 * page is just the shell.
 */
export default async function ProvisionOrganizationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isPlatformOwner) redirect("/dashboard");

  return (
    <WorkspacePageShell
      kicker="Platform · Provision"
      title="New organization"
      description="Create a workspace with its first admin. We'll email them an activation link that doubles as email verification."
      headerActions={
        <Link
          href="/superadmin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to workspaces
        </Link>
      }
    >
      <ProvisionOrgForm />
    </WorkspacePageShell>
  );
}
