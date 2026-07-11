import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { BillingCallbackClient } from "@/components/billing/BillingCallbackClient";

type BillingCallbackPageProps = {
  searchParams?: { reference?: string; trxref?: string };
};

/**
 * Outside the dashboard layout so suspended orgs can complete renew checkout
 * without being redirected away before the webhook lands.
 */
export default function BillingCallbackPage({ searchParams }: BillingCallbackPageProps) {
  const reference = (searchParams?.reference ?? searchParams?.trxref)?.trim() || undefined;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-16">
      <WorkspacePageShell
        className="mx-auto max-w-lg"
        kicker="Billing"
        title="Checkout"
        description="Confirming your Paystack payment."
      >
        <BillingCallbackClient reference={reference} />
      </WorkspacePageShell>
    </main>
  );
}
