import { BillingInvoiceSource, BillingInvoiceStatus, OrgPlan, SubscriptionStatus } from "@prisma/client";
import { AlertTriangle, Building2, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import { daysBetween, MAX_DUNNING_ATTEMPTS } from "@/lib/billing/constants";
import { prisma } from "@/lib/prisma";

import { RegenerateActivationButton } from "./RegenerateActivationButton";

export const dynamic = "force-dynamic";

/**
 * Platform-owner-only workspace directory. Lists every {@link Organization}
 * with its plan, activation state, and admin email. The "Provision new
 * organization" CTA leads to /superadmin/orgs/new.
 *
 * Permission gate: server-side redirect to /dashboard when the session user is
 * not a platform owner. There is no public link to this page; it is only
 * reachable via the nav item which is itself gated.
 */
export default async function SuperadminPage({
  searchParams
}: {
  searchParams?: { coverage?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isPlatformOwner) redirect("/dashboard");

  const now = new Date();
  const coverageFilter = searchParams?.coverage === "overdue";

  const orgs = await prisma.organization.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      activatedAt: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          trialStartsAt: true,
          trialEndsAt: true,
          pastDueSince: true,
          dunningAttempt: true,
          nextDunningAt: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          coverageOverdueSince: true
        }
      },
      billingInvoices: {
        where: {
          source: BillingInvoiceSource.ENTERPRISE_PAYABLE,
          status: BillingInvoiceStatus.PENDING
        },
        select: { id: true },
        take: 1
      },
      _count: { select: { events: true, users: true } },
      users: {
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, name: true, email: true, emailVerified: true }
      }
    }
  });

  const pendingCount = orgs.filter((o) => o.activatedAt === null).length;
  const overdueOrgs = orgs.filter(
    (o) => o.plan === OrgPlan.ENTERPRISE && o.subscription?.coverageOverdueSince
  );
  const listedOrgs = coverageFilter ? overdueOrgs : orgs;

  return (
    <WorkspacePageShell
      kicker="Platform"
      title="Workspaces"
      description="Provision and oversee every Eventflow workspace on this deployment. Only platform owners see this page."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/superadmin/settings">
            <Button variant="secondary" className="inline-flex items-center gap-2">
              Alert settings
            </Button>
          </Link>
          <Link href="/superadmin/orgs/new">
            <Button className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" aria-hidden /> Provision organization
            </Button>
          </Link>
        </div>
      }
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Tile
          icon={<Building2 className="h-4 w-4" aria-hidden />}
          label="Total workspaces"
          value={orgs.length.toString()}
        />
        <Tile
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          label="Activated"
          value={(orgs.length - pendingCount).toString()}
        />
        <Tile
          icon={<ShieldCheck className="h-4 w-4 text-amber-600" aria-hidden />}
          label="Pending activation"
          value={pendingCount.toString()}
        />
      </section>

      {overdueOrgs.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <div>
                <p className="font-medium">
                  {overdueOrgs.length} Enterprise workspace
                  {overdueOrgs.length === 1 ? "" : "s"} with overdue coverage
                </p>
                <p className="mt-0.5 text-xs text-amber-900/80">
                  Access is unchanged — follow up and create a renewal invoice when ready.
                </p>
              </div>
            </div>
            <Link
              href={coverageFilter ? "/superadmin" : "/superadmin?coverage=overdue"}
              className="text-xs font-medium text-amber-900 underline underline-offset-2"
            >
              {coverageFilter ? "Show all workspaces" : "View overdue only"}
            </Link>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-amber-200/80 bg-white">
            <Table
              headers={["Workspace", "Coverage ended", "Days overdue", "Pending payable", ""]}
              variant="workspace"
            >
              {overdueOrgs.map((org) => {
                const ended = org.subscription!.coverageOverdueSince!;
                const daysOverdue = Math.max(0, -daysBetween(now, ended));
                const hasPending = org.billingInvoices.length > 0;
                const renewHref = `/superadmin/orgs/${org.id}/billing?tab=invoices&prefill=renew&ended=${encodeURIComponent(ended.toISOString().slice(0, 10))}`;
                return (
                  <tr key={org.id} className="align-top border-t border-amber-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{org.name}</div>
                      <div className="font-mono text-[11px] text-zinc-500">{org.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {ended.toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-amber-900">{daysOverdue}d</td>
                    <td className="px-4 py-3">
                      {hasPending ? (
                        <Badge className="bg-amber-100 text-amber-900 ring-1 ring-amber-200">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-xs text-zinc-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={renewHref}
                        className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        Create invoice
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        </div>
      ) : null}

      {coverageFilter ? (
        <p className="text-xs text-zinc-500">
          Showing {listedOrgs.length} overdue Enterprise workspace
          {listedOrgs.length === 1 ? "" : "s"}.{" "}
          <Link href="/superadmin" className="font-medium text-sky-700 hover:underline">
            Clear filter
          </Link>
        </p>
      ) : null}

      {listedOrgs.length === 0 ? (
        <WorkspaceNotice variant="info">
          {coverageFilter
            ? "No Enterprise workspaces with overdue coverage."
            : "No workspaces yet. Provision the first one to get started."}
        </WorkspaceNotice>
      ) : (
        <Table
          headers={["Workspace", "Plan", "Billing", "Admin", "Status", "Stats", ""]}
          variant="workspace"
        >
          {listedOrgs.map((org) => {
            const admin = org.users[0];
            const isActivated = org.activatedAt !== null;
            return (
              <tr key={org.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="font-semibold text-zinc-900">{org.name}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-500">{org.slug}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-400">
                    Created {org.createdAt.toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <PlanBadge plan={org.plan} />
                </td>
                <td className="px-4 py-4">
                  <BillingCell plan={org.plan} subscription={org.subscription} now={now} />
                </td>
                <td className="px-4 py-4">
                  {admin ? (
                    <>
                      <div className="font-medium text-zinc-900">{admin.name ?? "—"}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{admin.email}</div>
                      {admin.emailVerified ? (
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-emerald-700">
                          Email verified
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-amber-700">
                          Email not verified
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-zinc-400">No admin</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {isActivated ? (
                    <Badge className="bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200">
                      Activated
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-900 ring-1 ring-amber-200">
                      Pending
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="text-xs text-zinc-600">
                    {org._count.events} event{org._count.events === 1 ? "" : "s"}
                  </div>
                  <div className="text-xs text-zinc-600">
                    {org._count.users} user{org._count.users === 1 ? "" : "s"}
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      href={`/superadmin/orgs/${org.id}/billing`}
                      className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                    >
                      Billing
                    </Link>
                    {!isActivated ? <RegenerateActivationButton orgId={org.id} /> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </WorkspacePageShell>
  );
}

function Tile({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

function PlanBadge({ plan }: { plan: OrgPlan }) {
  const cls =
    plan === OrgPlan.ENTERPRISE
      ? "bg-violet-100 text-violet-900 ring-1 ring-violet-200"
      : plan === OrgPlan.PRO
        ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200"
        : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
  const label = plan === OrgPlan.ENTERPRISE ? "Enterprise" : plan === OrgPlan.PRO ? "Pro" : "Free";
  return <Badge className={cls}>{label}</Badge>;
}

type SubscriptionSummary = {
  status: SubscriptionStatus;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  pastDueSince: Date | null;
  dunningAttempt: number;
  nextDunningAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  coverageOverdueSince: Date | null;
} | null;

function BillingStatusBadge({ status }: { status: SubscriptionStatus }) {
  const labels: Record<SubscriptionStatus, string> = {
    NONE: "No sub",
    TRIALING: "Trialing",
    ACTIVE: "Active",
    PAST_DUE: "Past due",
    CANCELLED: "Cancelled",
    TRIAL_EXPIRED: "Trial ended",
    SUSPENDED: "Suspended"
  };
  const cls =
    status === SubscriptionStatus.ACTIVE
      ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
      : status === SubscriptionStatus.TRIALING
        ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
        : status === SubscriptionStatus.PAST_DUE || status === SubscriptionStatus.SUSPENDED
          ? "bg-rose-100 text-rose-900 ring-1 ring-rose-200"
          : status === SubscriptionStatus.CANCELLED || status === SubscriptionStatus.TRIAL_EXPIRED
            ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
            : "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200";
  return <Badge className={cls}>{labels[status]}</Badge>;
}

function BillingCell({
  plan,
  subscription,
  now
}: {
  plan: OrgPlan;
  subscription: SubscriptionSummary;
  now: Date;
}) {
  if (plan === OrgPlan.ENTERPRISE) {
    if (subscription?.coverageOverdueSince) {
      const daysOverdue = Math.max(0, -daysBetween(now, subscription.coverageOverdueSince));
      return (
        <div className="min-w-[9.5rem] space-y-1.5">
          <Badge className="bg-amber-100 text-amber-900 ring-1 ring-amber-200">
            Coverage overdue · {daysOverdue}d
          </Badge>
          <div className="text-[11px] leading-snug text-zinc-500">
            Ended {subscription.coverageOverdueSince.toLocaleDateString()}
          </div>
        </div>
      );
    }

    const accessThrough = subscription?.currentPeriodEnd
      ? `Access through ${subscription.currentPeriodEnd.toLocaleDateString()}`
      : "No coverage window yet";
    return (
      <div className="min-w-[9.5rem] space-y-1.5">
        <Badge className="bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">Invoice-based</Badge>
        <div className="text-[11px] leading-snug text-zinc-500">{accessThrough}</div>
      </div>
    );
  }

  const status = subscription?.status ?? SubscriptionStatus.NONE;

  return (
    <div className="min-w-[9.5rem] space-y-1.5">
      <BillingStatusBadge status={status} />
      {subscription ? <BillingDetailLines sub={subscription} now={now} /> : null}
    </div>
  );
}

function BillingDetailLines({
  sub,
  now
}: {
  sub: NonNullable<SubscriptionSummary>;
  now: Date;
}) {
  const lines: string[] = [];

  if (sub.status === SubscriptionStatus.TRIALING && sub.trialEndsAt) {
    const remaining = daysBetween(now, sub.trialEndsAt);
    if (sub.trialStartsAt) {
      lines.push(`Started ${sub.trialStartsAt.toLocaleDateString()}`);
    }
    if (remaining >= 0) {
      lines.push(`${remaining}d left · ends ${sub.trialEndsAt.toLocaleDateString()}`);
    } else {
      lines.push(`${Math.abs(remaining)}d overdue · ended ${sub.trialEndsAt.toLocaleDateString()}`);
    }
  }

  if (sub.status === SubscriptionStatus.TRIAL_EXPIRED && sub.trialEndsAt) {
    const overdue = Math.max(0, -daysBetween(now, sub.trialEndsAt));
    lines.push(`Ended ${sub.trialEndsAt.toLocaleDateString()}`);
    if (overdue > 0) lines.push(`${overdue}d since expiry`);
  }

  if (sub.status === SubscriptionStatus.PAST_DUE && sub.pastDueSince) {
    const daysIn = Math.max(0, -daysBetween(now, sub.pastDueSince));
    const attempt = sub.dunningAttempt;
    const attemptLabel =
      attempt >= MAX_DUNNING_ATTEMPTS
        ? `retries exhausted (${attempt}/${MAX_DUNNING_ATTEMPTS})`
        : `retry ${attempt + 1}/${MAX_DUNNING_ATTEMPTS}`;
    lines.push(`${daysIn}d past due`);
    lines.push(attemptLabel);
    if (sub.nextDunningAt) {
      lines.push(`Next retry ${sub.nextDunningAt.toLocaleDateString()}`);
    }
  }

  if (sub.status === SubscriptionStatus.SUSPENDED && sub.pastDueSince) {
    const daysIn = Math.max(0, -daysBetween(now, sub.pastDueSince));
    lines.push(`Suspended · ${daysIn}d since past due`);
  }

  if (sub.status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd) {
    lines.push(
      sub.cancelAtPeriodEnd
        ? `Access until ${sub.currentPeriodEnd.toLocaleDateString()}`
        : `Renews ${sub.currentPeriodEnd.toLocaleDateString()}`
    );
  }

  if (sub.status === SubscriptionStatus.CANCELLED) {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now.getTime()) {
      lines.push(`Access until ${sub.currentPeriodEnd.toLocaleDateString()}`);
    } else if (sub.currentPeriodEnd) {
      lines.push(`Ended ${sub.currentPeriodEnd.toLocaleDateString()}`);
    }
  }

  if (lines.length === 0) return null;

  return (
    <div className="space-y-0.5 text-[11px] leading-snug text-zinc-500">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}
