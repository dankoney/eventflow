"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card } from "@/components/ui/Card";

type GuestStatusChartProps = {
  data: { label: string; count: number }[];
  title?: string;
  emptyHint?: string;
};

export function GuestStatusChart({
  data,
  title = "Guests by status",
  emptyHint = "No status data yet."
}: GuestStatusChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({ ...d, name: d.label }));

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
              <XAxis type="number" allowDecimals={false} className="text-xs" />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11 }}
                className="text-xs"
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [value ?? 0, "Guests"]}
              />
              <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Guests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
