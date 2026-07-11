"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card } from "@/components/ui/Card";

type EventFeedbackChartProps = {
  data: Array<{ label: string; emoji: string; count: number }>;
  title?: string;
  /** When true, omit outer Card wrapper (parent provides layout). */
  embedded?: boolean;
};

const BAR_COLORS = ["#ef4444", "#f97316", "#94a3b8", "#22c55e", "#10b981"];

export function EventFeedbackChart({
  data,
  title = "Feedback by rating",
  embedded = false
}: EventFeedbackChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d, i) => ({
    name: `${d.emoji} ${d.label}`,
    shortName: d.emoji,
    count: d.count,
    color: BAR_COLORS[i] ?? "#64748b"
  }));

  const inner = (
    <>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">No feedback responses yet.</p>
      ) : (
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 8, right: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" vertical={false} />
              <XAxis dataKey="shortName" tick={{ fontSize: 20 }} interval={0} />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [value ?? 0, "Responses"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { name?: string } | undefined;
                  return row?.name ?? "";
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );

  if (embedded) return <div className="min-w-0">{inner}</div>;

  return <Card className="p-4">{inner}</Card>;
}
