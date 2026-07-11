"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card } from "@/components/ui/Card";
import type { DeclineReasonCount } from "@/lib/db/eventDeclineAnalytics";

const PIE_COLORS = ["#0f172a", "#334155", "#64748b", "#0ea5e9", "#a855f7"];

type EventDeclineReasonsChartProps = {
  data: DeclineReasonCount[];
  title?: string;
};

export function EventDeclineReasonsChart({
  data,
  title = "Decline reasons (RSVP)"
}: EventDeclineReasonsChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const pieData = data.map((d) => ({ name: d.label, value: d.count, key: d.reason }));
  const barData = data.map((d) => ({ name: d.label, count: d.count }));

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">
        From guests who declined through the invitation RSVP flow.
      </p>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">No decline feedback recorded yet.</p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="h-64 min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(value) => [value ?? 0, "Declines"]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64 min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
                <XAxis type="number" allowDecimals={false} className="text-xs" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} className="text-xs" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(value) => [value ?? 0, "Count"]}
                />
                <Bar dataKey="count" fill="#64748b" radius={[0, 4, 4, 0]} name="Declines" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}
