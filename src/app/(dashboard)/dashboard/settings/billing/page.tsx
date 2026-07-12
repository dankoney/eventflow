import { BillingInvoiceSource, BillingInvoiceStatus, Role, SubscriptionStatus } from "@prisma/client";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BillingAutoRenewalToggle } from "@/components/billing/BillingAutoRenewalToggle";
import { BillingDetailsForm } from "@/components/billing/BillingDetailsForm";
import { BillingReceiptDownloadButton } from "@/components/billing/BillingReceiptDownloadButton";
import { BillingRenewNowSection } from "@/components/billing/BillingRenewNowButton";
import { BillingSubscribeButton } from "@/components/billing/BillingSubscribeButton";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { getBillingRenewOptionsAction } from "@/lib/actions/billing.actions";
import { daysBetween } from "@/lib/billing/constants";
import { formatGhsFromPesewas } from "@/lib/billing/formatMoney";
import { getPlatformBillingAlertSettings } from "@/lib/billing/platformSettings";
import { getOrgBillingAccess } from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function statusLabel(status: SubscriptionStatus): string {
  const map: Record<SubscriptionStatus, string> = {
    NONE: "No subscription",
    TRIALING: "Trial",
    ACTIVE: "Active",
    PAST_DUE: "Past due",
    CANCELLED: "Cancelled",
    TRIAL_EXPIRED: "Trial ended",
    SUSPENDED: "Suspended"
  };
  return map[status];
}

function invoiceStatusBadge(status: BillingInvoiceStatus) {
  const cls =
    status === BillingInvoiceStatus.PAID
      ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
      : status === BillingInvoiceStatus.FAILED
        ? "bg-rose-100 text-rose-900 ring-1 ring-rose-200"
        : status === BillingInvoiceStatus.CANCELLED
          ? "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
          : "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
  return <Badge className={cls}>{status}</Badge>;
}

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN) redirect("/dashboard");

  const now = new Date();
  const [org, access, invoices, renewOptionsResult, platformSettings] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: {
        name: true,
        plan: true,
        billingLegalName: true,
        billingAddressLine1: true,
        billingAddressLine2: true,
        billingCity: true,
        billingRegion: true,
        billingPostalCode: true,
        billingCountry: true,
        billingCustomer: { select: { billingEmail: true } },
        subscription: {
          select: {
            status: true,
            trialStartsAt: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            coverageOverdueSince: true,
            pastDueSince: true,
            cardLast4: true,
            cardExpMonth: true,
            cardExpYear: true,
            cardExpiringNotifiedAt: true,
            currency: true,
            paystackStatus: true,
            paystackSubscriptionCode: true,
            authorizationCode: true
          }
        }
      }
    }),
    getOrgBillingAccess(session.user.orgId),
    prisma.billingInvoice.findMany({
      where: { orgId: session.user.orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amountPesewas: true,
        currency: true,
        status: true,
        source: true,
        paidAt: true,
        createdAt: true,
        dueDate: true,
        periodStart: true,
        periodEnd: true,
        paystackInvoiceCode: true,
        paystackPaymentRequestCode: true,
        paymentPageUrl: true
      }
    }),
    getBillingRenewOptionsAction(),
    getPlatformBillingAlertSettings()
  ]);

  if (!org || !access) redirect("/login");

  const supportEmail = platformSettings.supportEmail;

  const isEnterprise = org.plan === "ENTERPRISE";
  const subscription = org.subscription;
  const stillInPaidPeriod = Boolean(
    subscription?.currentPeriodEnd && subscription.currentPeriodEnd.getTime() > now.getTime()
  );
  const periodExpired = Boolean(
    subscription?.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= now.getTime()
  );
  const hasAuthorization = Boolean(subscription?.authorizationCode);

  const showSubscribe =
    !isEnterprise &&
    !hasAuthorization &&
    (access.status === SubscriptionStatus.TRIALING ||
      access.status === SubscriptionStatus.TRIAL_EXPIRED ||
      access.status === SubscriptionStatus.NONE ||
      access.status === SubscriptionStatus.PAST_DUE ||
      (access.status === SubscriptionStatus.CANCELLED && !stillInPaidPeriod));

  const showUpdatePayment =
    !isEnterprise && access.status === SubscriptionStatus.PAST_DUE && hasAuthorization;

  const showAutoRenewalToggle =
    !isEnterprise &&
    Boolean(subscription) &&
    stillInPaidPeriod &&
    (access.status === SubscriptionStatus.ACTIVE ||
      (access.status === SubscriptionStatus.CANCELLED && subscription?.cancelAtPeriodEnd));

  const showRenewNow =
    !isEnterprise &&
    hasAuthorization &&
    (periodExpired ||
      stillInPaidPeriod ||
      access.status === SubscriptionStatus.PAST_DUE ||
      access.status === SubscriptionStatus.TRIAL_EXPIRED ||
      access.status === SubscriptionStatus.CANCELLED);

  const periodEndLabel = subscription?.currentPeriodEnd
    ? subscription.currentPeriodEnd.toLocaleDateString(undefined, { dateStyle: "long" })
    : null;

  const trialDaysLeft =
    subscription?.status === SubscriptionStatus.TRIALING && subscription.trialEndsAt
      ? Math.max(0, daysBetween(now, subscription.trialEndsAt))
      : null;

  const cardLabel =
    subscription?.cardLast4 != null
      ? `•••• ${subscription.cardLast4}${
          subscription.cardExpMonth && subscription.cardExpYear
            ? ` · exp ${String(subscription.cardExpMonth).padStart(2, "0")}/${subscription.cardExpYear}`
            : ""
        }`
      : null;

  return (
    <WorkspacePageShell
      className="max-w-3xl"
      kicker="Settings"
      title="Billing"
      description={
        isEnterprise
          ? "Enterprise plan — invoiced by EventFlow. Contact billing for plan changes."
          : "Plan, payment method, invoices, and renewal for this workspace."
      }
    >
      <div className="mb-6">
        <Suspense fallback={null}>
          <SettingsNav isAdmin canManageLocations canManageStaffDirectory />
        </Suspense>
      </div>

      <div className="space-y-6">
        {isEnterprise ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            Your plan is managed by EventFlow. Access is renewed through Enterprise invoices
            {supportEmail ? (
              <>
                {" "}
                — contact{" "}
                <a className="underline" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>{" "}
                for billing changes
              </>
            ) : (
              <> — contact your EventFlow account manager for billing changes</>
            )}
            . Self-serve PRO subscribe / renew is not available on Enterprise.
            {periodEndLabel && !subscription?.coverageOverdueSince ? (
              <span className="mt-1 block font-medium">Access through {periodEndLabel}.</span>
            ) : !subscription?.coverageOverdueSince ? (
              <span className="mt-1 block text-sky-800/80">
                No active coverage window yet — it appears after your next paid Enterprise invoice.
              </span>
            ) : null}
          </div>
        ) : null}

        {isEnterprise && subscription?.coverageOverdueSince ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Coverage through{" "}
            {subscription.coverageOverdueSince.toLocaleDateString(undefined, {
              dateStyle: "long"
            })}{" "}
            has ended. Access is unchanged; EventFlow will follow up about renewal.
          </div>
        ) : null}

        {access.status === SubscriptionStatus.PAST_DUE && !isEnterprise ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
            Your last payment failed. Use Renew now to retry the charge, or update your payment method.
          </div>
        ) : null}

        {subscription?.cardExpiringNotifiedAt && !isEnterprise ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Your card on file is expiring soon
            {cardLabel ? <> ({cardLabel})</> : null}. Update payment via checkout to keep renewals working.
          </div>
        ) : null}

        <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Current plan</h2>
              <p className="mt-1 text-sm text-zinc-500">{org.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sky-100 text-sky-900 ring-1 ring-sky-200">{org.plan}</Badge>
              {isEnterprise ? (
                <Badge className="bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">
                  Invoice-based
                </Badge>
              ) : (
                <Badge className="bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200">
                  {subscription?.cancelAtPeriodEnd &&
                  stillInPaidPeriod &&
                  (access.status === SubscriptionStatus.ACTIVE ||
                    access.status === SubscriptionStatus.CANCELLED)
                    ? "Won't renew"
                    : statusLabel(access.status)}
                </Badge>
              )}
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {trialDaysLeft !== null && subscription?.trialEndsAt ? (
              <>
                <div>
                  <dt className="text-zinc-500">Trial remaining</dt>
                  <dd className="mt-0.5 font-medium text-zinc-900">
                    {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Trial ends</dt>
                  <dd className="mt-0.5 font-medium text-zinc-900">
                    {subscription.trialEndsAt.toLocaleDateString(undefined, { dateStyle: "long" })}
                  </dd>
                </div>
              </>
            ) : null}

            {periodEndLabel &&
            !isEnterprise &&
            (access.status === SubscriptionStatus.ACTIVE ||
              access.status === SubscriptionStatus.CANCELLED) ? (
              <div>
                <dt className="text-zinc-500">
                  {subscription?.cancelAtPeriodEnd ? "Access until" : "Current period ends"}
                </dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{periodEndLabel}</dd>
              </div>
            ) : null}

            {isEnterprise && periodEndLabel ? (
              <div>
                <dt className="text-zinc-500">Access through</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{periodEndLabel}</dd>
              </div>
            ) : null}

            {org.billingCustomer?.billingEmail ? (
              <div>
                <dt className="text-zinc-500">Billing email</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{org.billingCustomer.billingEmail}</dd>
              </div>
            ) : null}

            {cardLabel && !isEnterprise ? (
              <div>
                <dt className="text-zinc-500">Payment method</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{cardLabel}</dd>
              </div>
            ) : null}
          </dl>

          {showSubscribe ? (
            <div className="space-y-2 border-t border-zinc-100 pt-4">
              <p className="text-sm text-zinc-600">
                {access.status === SubscriptionStatus.TRIALING
                  ? "Add a payment method to convert your trial to Eventflow Pro Tier."
                  : "Subscribe to Eventflow Pro Tier."}
              </p>
              {renewOptionsResult.success && renewOptionsResult.data ? (
                <BillingSubscribeButton
                  label={
                    access.status === SubscriptionStatus.TRIALING
                      ? "Add payment / Subscribe to PRO"
                      : "Subscribe to PRO"
                  }
                  options={renewOptionsResult.data.options}
                  defaultInterval={renewOptionsResult.data.defaultInterval}
                />
              ) : (
                <p className="text-sm text-rose-700">
                  {renewOptionsResult.error ??
                    "Unable to load PRO plan pricing. Check Paystack plan codes match the API key mode (test vs live)."}
                </p>
              )}
            </div>
          ) : null}

          {showUpdatePayment ? (
            <div className="space-y-2 border-t border-zinc-100 pt-4">
              <p className="text-sm text-zinc-600">
                Or complete checkout to replace the payment method on file.
              </p>
              {renewOptionsResult.success && renewOptionsResult.data ? (
                <BillingSubscribeButton
                  label="Update payment method"
                  options={renewOptionsResult.data.options}
                  defaultInterval={renewOptionsResult.data.defaultInterval}
                />
              ) : (
                <p className="text-sm text-rose-700">
                  {renewOptionsResult.error ?? "Unable to load plan pricing for checkout."}
                </p>
              )}
            </div>
          ) : null}

          {showAutoRenewalToggle && subscription ? (
            <BillingAutoRenewalToggle
              cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
              periodEndLabel={periodEndLabel}
              canReenableSilently={hasAuthorization}
            />
          ) : null}

          {showRenewNow && renewOptionsResult.success && renewOptionsResult.data ? (
            <BillingRenewNowSection
              expired={periodExpired || !stillInPaidPeriod}
              options={renewOptionsResult.data.options}
              defaultInterval={renewOptionsResult.data.defaultInterval}
              savedCardLast4={renewOptionsResult.data.savedCardLast4}
              periodEndLabel={stillInPaidPeriod ? periodEndLabel : null}
            />
          ) : null}

          <p className="text-xs text-zinc-500">
            Payments are processed securely by Paystack (GHS).
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Billing details</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Optional. Shown as “Billed to” on tax invoices / receipts. Leave blank to use your workspace name
              only.
            </p>
          </div>
          <BillingDetailsForm
            initial={{
              billingLegalName: org.billingLegalName ?? "",
              billingAddressLine1: org.billingAddressLine1 ?? "",
              billingAddressLine2: org.billingAddressLine2 ?? "",
              billingCity: org.billingCity ?? "",
              billingRegion: org.billingRegion ?? "",
              billingPostalCode: org.billingPostalCode ?? "",
              billingCountry: org.billingCountry ?? ""
            }}
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Invoice history</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Subscription charges and Enterprise invoices. Pay pending invoices or download a Tax Invoice /
              Receipt for paid ones.
            </p>
          </div>

          {invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No invoices yet. They appear after a successful subscription charge or when EventFlow sends you
              an invoice.
            </div>
          ) : (
            <Table headers={["Date", "Amount", "Status", "Reference", ""]} variant="workspace">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 text-zinc-700">
                    {(invoice.paidAt ?? invoice.createdAt).toLocaleDateString(undefined, {
                      dateStyle: "medium"
                    })}
                    {invoice.dueDate && invoice.status === BillingInvoiceStatus.PENDING ? (
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        Due {invoice.dueDate.toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </div>
                    ) : null}
                    {invoice.periodStart && invoice.periodEnd ? (
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        {invoice.periodStart.toLocaleDateString()} – {invoice.periodEnd.toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {formatGhsFromPesewas(invoice.amountPesewas, invoice.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {invoiceStatusBadge(invoice.status)}
                      {invoice.source === BillingInvoiceSource.MANUAL ? (
                        <Badge className="bg-violet-100 text-violet-900 ring-1 ring-violet-200">
                          Manual
                        </Badge>
                      ) : null}
                      {invoice.source === BillingInvoiceSource.ENTERPRISE_PAYABLE ? (
                        <Badge className="bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200">
                          Invoice
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                    {invoice.paystackPaymentRequestCode ?? invoice.paystackInvoiceCode ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {invoice.status === BillingInvoiceStatus.PAID ? (
                      <BillingReceiptDownloadButton invoiceId={invoice.id} />
                    ) : invoice.status === BillingInvoiceStatus.PENDING &&
                      invoice.paymentPageUrl ? (
                      <a
                        href={invoice.paymentPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Pay now
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </WorkspacePageShell>
  );
}
