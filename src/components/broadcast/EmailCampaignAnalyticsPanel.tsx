import { EmailCampaignEngagementChart } from "@/components/charts/EmailCampaignEngagementChart";
import { formatEmailCampaignRate } from "@/lib/db/emailCampaignAnalytics";
import { cn } from "@/lib/utils";
import type { EmailCampaignAnalyticsDetail } from "@/types/emailCampaignAnalytics";

type EmailCampaignAnalyticsPanelProps = {
  analytics: EmailCampaignAnalyticsDetail;
};

const COUNT_METRICS: Array<{
  key: keyof EmailCampaignAnalyticsDetail["counts"];
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}> = [
  { key: "total", label: "Total recipients", tone: "neutral" },
  { key: "sent", label: "Sent", tone: "neutral" },
  { key: "delivered", label: "Delivered", tone: "good" },
  { key: "opened", label: "Opened", tone: "good" },
  { key: "clicked", label: "Clicked", tone: "good" },
  { key: "bounced", label: "Bounced", tone: "bad" },
  { key: "complained", label: "Complained", tone: "bad" },
  { key: "skipped_unsubscribed", label: "Skipped (unsubscribed)", tone: "warn" }
];

const RATE_METRICS: Array<{
  key: keyof EmailCampaignAnalyticsDetail["rates"];
  label: string;
  hint: string;
}> = [
  { key: "deliveryRate", label: "Delivery rate", hint: "delivered ÷ sent" },
  { key: "openRate", label: "Open rate", hint: "opened ÷ delivered" },
  { key: "clickRate", label: "Click rate", hint: "clicked ÷ delivered" },
  { key: "bounceRate", label: "Bounce rate", hint: "bounced ÷ sent" },
  { key: "complaintRate", label: "Complaint rate", hint: "complained ÷ delivered" }
];

const TONE_STYLES = {
  neutral: "border-zinc-200 bg-white",
  good: "border-emerald-100 bg-emerald-50/50",
  warn: "border-amber-100 bg-amber-50/50",
  bad: "border-red-100 bg-red-50/50"
} as const;

export function EmailCampaignAnalyticsPanel({ analytics }: EmailCampaignAnalyticsPanelProps) {
  const { counts, rates, timeline } = analytics;
  const hasEngagement = counts.sent > 0 || counts.skipped_unsubscribed > 0;

  if (!hasEngagement) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
        Analytics will populate after recipients are materialized and the broadcast sends.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Campaign analytics</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Read-only aggregates from recipient webhook state — no new tracking added here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COUNT_METRICS.map((metric) => (
          <div
            key={metric.key}
            className={cn(
              "rounded-xl border px-4 py-3",
              TONE_STYLES[metric.tone ?? "neutral"]
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {counts[metric.key].toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {RATE_METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3"
          >
            <p className="text-xs font-medium text-indigo-900/80">{metric.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-indigo-950">
              {formatEmailCampaignRate(rates[metric.key])}
            </p>
            <p className="mt-0.5 text-[11px] text-indigo-800/60">{metric.hint}</p>
          </div>
        ))}
      </div>

      <EmailCampaignEngagementChart data={timeline} />
    </section>
  );
}
