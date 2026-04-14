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

type AttendanceChartProps = {
  data: { label: string; count: number }[];
  title?: string;
  emptyHint?: string;
};

export function AttendanceChart({
  data,
  title = "Check-ins by hour",
  emptyHint = "No check-ins recorded yet."
}: AttendanceChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data;

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9 }}
                interval={2}
                angle={-35}
                textAnchor="end"
                height={56}
                className="text-xs"
              />
              <YAxis allowDecimals={false} className="text-xs" width={36} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [value ?? 0, "Check-ins"]}
              />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Check-ins" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
