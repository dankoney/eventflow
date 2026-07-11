import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getSuperadminOrgBillingDetailAction } from "@/lib/actions/superadminBilling.actions";

import { PaystackDriftPanel } from "./PaystackDriftPanel";
import { SuperadminBillingToolkit, type ToolkitInvoice } from "./SuperadminBillingToolkit";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { orgId: string };
  searchParams?: { tab?: string; prefill?: string; ended?: string };
};

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

export default async function SuperadminOrgBillingPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isPlatformOwner) redirect("/dashboard");

  const { orgId } = params;
  const initialTab =
    searchParams?.tab === "account" ||
    searchParams?.tab === "plan" ||
    searchParams?.tab === "billing" ||
    searchParams?.tab === "invoices"
      ? searchParams.tab
      : undefined;
  const renewPrefill =
    searchParams?.prefill === "renew"
      ? {
          endedDateLabel: searchParams.ended?.trim() || "prior coverage"
        }
      : null;

  const result = await getSuperadminOrgBillingDetailAction({ orgId });

  if (!result.success || !result.data) {
    return (
      <WorkspacePageShell
        kicker="Platform"
        title="Billing"
        description="Unable to load organization billing."
        headerActions={
          <Link href="/superadmin">
            <Button variant="secondary" className="inline-flex items-center gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to workspaces
            </Button>
          </Link>
        }
      >
        <WorkspaceNotice variant="error">
          {result.error ?? "Failed to load billing detail."}
        </WorkspaceNotice>
      </WorkspacePageShell>
    );
  }

  const { org, subscription, customer, invoices, manualActions, paystack, paystackError } =
    result.data;

  const initialLocal = {
    plan: org.plan,
    subscription: subscription
      ? {
          status: subscription.status,
          paystackSubscriptionCode: subscription.paystackSubscriptionCode,
          paystackPlanCode: subscription.paystackPlanCode,
          paystackStatus: subscription.paystackStatus,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: toIso(subscription.currentPeriodEnd)
        }
      : null,
    billingCustomer: customer
      ? {
          paystackCustomerCode: customer.paystackCustomerCode,
          billingEmail: customer.billingEmail
        }
      : null
  };

  const toolkitInvoices: ToolkitInvoice[] = invoices.map((inv) => ({
    id: inv.id,
    amountPesewas: inv.amountPesewas,
    currency: inv.currency,
    status: inv.status,
    source: inv.source,
    paidAt: toIso(inv.paidAt),
    createdAt: toIso(inv.createdAt) ?? new Date().toISOString(),
    dueDate: toIso(inv.dueDate),
    paystackInvoiceCode: inv.paystackInvoiceCode,
    paystackPaymentRequestCode: inv.paystackPaymentRequestCode,
    paymentPageUrl: inv.paymentPageUrl
  }));

  return (
    <WorkspacePageShell
      kicker="Platform"
      title={`${org.name} · Billing`}
      description={`Slug ${org.slug} · plan ${org.plan}${
        org.plan === "ENTERPRISE"
          ? " · invoice-based"
          : subscription
            ? ` · ${subscription.status}`
            : ""
      }`}
      headerActions={
        <Link href="/superadmin">
          <Button variant="secondary" className="inline-flex items-center gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to workspaces
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <PaystackDriftPanel
          orgId={org.id}
          initialLocal={initialLocal}
          initialPaystack={paystack}
          initialPaystackError={paystackError}
        />

        <SuperadminBillingToolkit
          orgId={org.id}
          orgPlan={org.plan}
          invoices={toolkitInvoices}
          subscriptionStatus={subscription?.status ?? null}
          initialTab={initialTab}
          renewPrefill={renewPrefill}
        />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Audit trail</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Manual billing actions for this workspace (newest first).
            </p>
          </div>

          {manualActions.length === 0 ? (
            <WorkspaceNotice variant="info">No manual billing actions yet.</WorkspaceNotice>
          ) : (
            <Table
              headers={["When", "Action", "Actor", "Reason"]}
              variant="workspace"
            >
              {manualActions.map((row) => (
                <tr key={row.id} className="align-top border-t border-zinc-100">
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200">
                      {row.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700">
                    <div className="font-medium">{row.actorName ?? "—"}</div>
                    <div className="text-zinc-500">{row.actorEmail ?? row.actorUserId}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{row.reason}</td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </WorkspacePageShell>
  );
}
