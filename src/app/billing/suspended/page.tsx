import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { BillingRenewNowSection } from "@/components/billing/BillingRenewNowButton";
import { Button } from "@/components/ui/Button";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getBillingRenewOptionsAction } from "@/lib/actions/billing.actions";
import { getOrgBillingAccess } from "@/lib/db/billing";

/**
 * Shown when a hard-suspended workspace hits the dashboard gate.
 * Outside the dashboard layout so we do not redirect-loop.
 * OTP sign-in is allowed for suspended orgs so they can reach renew here.
 */
export default async function BillingSuspendedPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.isPlatformOwner) redirect("/superadmin");

  const access = await getOrgBillingAccess(session.user.orgId);
  if (access?.canLogin) redirect("/dashboard");

  const renewOptionsResult = await getBillingRenewOptionsAction();

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-16">
      <WorkspacePageShell
        className="mx-auto max-w-lg"
        kicker="Billing"
        title="Workspace suspended"
        description="Payment retries were exhausted. Renew below to restore access for your team."
      >
        <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-700">
            Creating events and signing in are blocked until payment succeeds. Existing data is
            preserved.
          </p>

          {renewOptionsResult.success && renewOptionsResult.data ? (
            <BillingRenewNowSection
              expired
              standalone
              options={renewOptionsResult.data.options}
              defaultInterval={renewOptionsResult.data.defaultInterval}
              savedCardLast4={renewOptionsResult.data.savedCardLast4}
            />
          ) : (
            <p className="text-sm text-rose-700">
              {renewOptionsResult.error ?? "Unable to load renew options. Contact support."}
            </p>
          )}

          <div className="flex flex-wrap gap-3 border-t border-zinc-100 pt-4">
            <Link
              href="/billing/callback"
              className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline"
            >
              Already paid? Check status
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </WorkspacePageShell>
    </main>
  );
}
