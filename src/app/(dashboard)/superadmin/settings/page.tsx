import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getPlatformBillingAlertSettings } from "@/lib/billing/platformSettings";

import { PlatformBillingAlertSettingsForm } from "./PlatformBillingAlertSettingsForm";

export const dynamic = "force-dynamic";

export default async function SuperadminSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isPlatformOwner) redirect("/dashboard");

  const settings = await getPlatformBillingAlertSettings();

  return (
    <WorkspacePageShell
      kicker="Platform"
      title="Platform settings"
      description="Support contact and who gets blind-copied on PRO / Enterprise billing due alerts."
      headerActions={
        <Link href="/superadmin">
          <Button variant="secondary" className="inline-flex items-center gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to workspaces
          </Button>
        </Link>
      }
    >
      <section className="max-w-xl space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Billing alert notifications</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Due alerts go to the workspace billing recipient. Addresses below are BCC’d so
            customers do not see your internal copies.
          </p>
        </div>
        <PlatformBillingAlertSettingsForm
          initialSupportEmail={settings.supportEmail ?? ""}
          initialBillingAlertCcEmailsText={settings.billingAlertCcEmails.join("\n")}
        />
      </section>
    </WorkspacePageShell>
  );
}
