import { EmailCampaignStatus, Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkspacePageShell } from "@/components/ui/WorkspacePageShell";
import {
  formatEmailCampaignRate,
  listEmailCampaignsWithAnalyticsForOrg
} from "@/lib/db/emailCampaignAnalytics";
import { cn, formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<EmailCampaignStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PREPARING: "bg-violet-100 text-violet-900",
  SCHEDULED: "bg-blue-100 text-blue-800",
  SENDING: "bg-amber-100 text-amber-900",
  SENT: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800"
};

export default async function EmailCampaignsPage() {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.MARKETING) {
    redirect("/dashboard");
  }

  const campaigns = await listEmailCampaignsWithAnalyticsForOrg(session.user.orgId);

  return (
    <WorkspacePageShell
      className="w-full min-w-0 max-w-7xl"
      clipContent={false}
      kicker="Marketing"
      title="Campaigns"
      description="Compare broadcast performance across campaigns — open rates, delivery, and send dates."
      headerActions={
        <Link
          href="/broadcasts/campaigns/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          New campaign
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/broadcasts" className="font-medium text-zinc-600 hover:text-zinc-900">
          Segments
        </Link>
        <Link href="/broadcasts/templates" className="font-medium text-zinc-600 hover:text-zinc-900">
          Templates
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">Status</th>
              <th className="hidden px-4 py-3 font-semibold sm:table-cell">Sent</th>
              <th className="hidden px-4 py-3 font-semibold lg:table-cell">Recipients</th>
              <th className="hidden px-4 py-3 font-semibold xl:table-cell">Open rate</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No campaigns yet.{" "}
                  <Link
                    href="/broadcasts/campaigns/new"
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{c.subject}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{c.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{c.templateName}</p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLES[c.status as EmailCampaignStatus]
                      )}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                    {c.sentAt ? formatDate(c.sentAt) : c.scheduledAt ? `Scheduled ${formatDate(c.scheduledAt)}` : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                    {c.analytics.counts.total > 0 ? c.analytics.counts.total.toLocaleString() : "—"}
                  </td>
                  <td className="hidden px-4 py-3 font-medium tabular-nums text-zinc-900 xl:table-cell">
                    {formatEmailCampaignRate(c.analytics.rates.openRate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/broadcasts/campaigns/${c.id}`}
                      className="text-sm font-medium text-indigo-700 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WorkspacePageShell>
  );
}
