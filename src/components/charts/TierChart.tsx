"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

import { Card } from "@/components/ui/Card";

const COLORS: Record<string, string> = {
  A: "#0f172a",
  B: "#475569",
  C: "#94a3b8"
};

type TierChartProps = {
  data: { tier: string; count: number }[];
  title?: string;
  emptyHint?: string;
};

export function TierChart({
  data,
  title = "Guests by tier",
  emptyHint = "No tier data yet."
}: TierChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({ name: `Tier ${d.tier}`, value: d.count, tier: d.tier }));

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.tier} fill={COLORS[entry.tier] ?? "#cbd5e1"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [value ?? 0, "Guests"]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
