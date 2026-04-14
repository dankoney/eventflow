"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card } from "@/components/ui/Card";

type RegistrationChartProps = {
  data: { day: string; count: number }[];
  title?: string;
  emptyHint?: string;
};

export function RegistrationChart({
  data,
  title = "Registrations by day",
  emptyHint = "No registrations in this window yet."
}: RegistrationChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    ...d,
    label: formatDayLabel(d.day)
  }));

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
              <defs>
                <linearGradient id="fillReg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                formatter={(value) => [value ?? 0, "New registrations"]}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { day?: string } | undefined;
                  return p?.day ?? "";
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#0284c7"
                strokeWidth={2}
                fill="url(#fillReg)"
                name="Registrations"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function formatDayLabel(isoDay: string) {
  try {
    const d = new Date(`${isoDay}T12:00:00`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoDay;
  }
}
