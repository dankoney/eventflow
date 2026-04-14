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
import { truncate } from "@/lib/utils";

type TopEventsChartProps = {
  data: { name: string; guestCount: number }[];
  title?: string;
  emptyHint?: string;
};

export function TopEventsChart({
  data,
  title = "Events by guest volume",
  emptyHint = "No events with guests yet."
}: TopEventsChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortName: truncate(d.name, 36)
  }));
  const total = chartData.reduce((s, d) => s + d.guestCount, 0);

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
              <XAxis type="number" allowDecimals={false} className="text-xs" />
              <YAxis
                type="category"
                dataKey="shortName"
                width={148}
                tick={{ fontSize: 10 }}
                className="text-xs"
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [value ?? 0, "Guests"]}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { name?: string } | undefined;
                  return p?.name ?? "";
                }}
              />
              <Bar dataKey="guestCount" fill="#6366f1" radius={[0, 4, 4, 0]} name="Guests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
