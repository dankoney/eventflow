"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card } from "@/components/ui/Card";
import type { EmailCampaignEngagementBucket } from "@/types/emailCampaignAnalytics";

type EmailCampaignEngagementChartProps = {
  data: EmailCampaignEngagementBucket[];
  title?: string;
  emptyHint?: string;
};

const SERIES = [
  { key: "sent", label: "Sent", color: "#64748b" },
  { key: "delivered", label: "Delivered", color: "#0284c7" },
  { key: "opened", label: "Opened", color: "#7c3aed" },
  { key: "clicked", label: "Clicked", color: "#059669" }
] as const;

export function EmailCampaignEngagementChart({
  data,
  title = "Engagement over time",
  emptyHint = "Engagement events will appear here after the broadcast sends."
}: EmailCampaignEngagementChartProps) {
  const total = data.reduce(
    (sum, row) => sum + row.sent + row.delivered + row.opened + row.clicked,
    0
  );

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                className="text-xs"
              />
              <YAxis allowDecimals={false} className="text-xs" width={36} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
