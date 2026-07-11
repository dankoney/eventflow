"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card } from "@/components/ui/Card";
import type { PollPositionTally } from "@/lib/db/pollTally";

const OPPOSED_PALETTE = [
  "#0f172a",
  "#1d4ed8",
  "#0e7490",
  "#a16207",
  "#9d174d",
  "#15803d",
  "#7c3aed",
  "#b91c1c"
];
const CONFIDENCE_COLOR: Record<"YES" | "NO" | "ABSTAIN", string> = {
  YES: "#15803d",
  NO: "#b91c1c",
  ABSTAIN: "#475569"
};

type PollTallyChartProps = {
  position: PollPositionTally;
};

/**
 * Per-position live tally. Opposed contests render a horizontal candidate bar
 * chart sorted by votes desc; unopposed contests render a three-bar Yes/No/Abstain
 * chart. Empty positions show an unobtrusive placeholder rather than a stretched
 * chart with zero data.
 */
export function PollTallyChart({ position }: PollTallyChartProps) {
  if (position.isUnopposed) {
    const conf = position.confidence ?? { yes: 0, no: 0, abstain: 0 };
    const data = [
      { key: "YES" as const, label: "Yes", count: conf.yes },
      { key: "NO" as const, label: "No", count: conf.no },
      { key: "ABSTAIN" as const, label: "Abstain", count: conf.abstain }
    ];
    return (
      <Card className="p-4">
        <ChartHeader
          title={position.title}
          subtitle="Confidence vote · unopposed"
          totalLabel={`${position.totalVotes} cast`}
        />
        {position.totalVotes === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-4 h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: "rgba(15,23,42,0.05)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(value) => [value, "Votes"]}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.map((d) => (
                    <Cell key={d.key} fill={CONFIDENCE_COLOR[d.key]} />
                  ))}
                  <LabelList dataKey="count" position="top" className="fill-slate-600" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    );
  }

  const sorted = [...position.candidates].sort((a, b) => b.votes - a.votes);
  return (
    <Card className="p-4">
      <ChartHeader
        title={position.title}
        subtitle={`Opposed · ${position.candidates.length} candidates`}
        totalLabel={`${position.totalVotes} cast`}
      />
      {position.totalVotes === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted.map((c) => ({ name: c.name, votes: c.votes }))}
              layout="vertical"
              margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#0f172a", fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
                width={140}
              />
              <Tooltip
                cursor={{ fill: "rgba(15,23,42,0.05)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [value, "Votes"]}
              />
              <Bar dataKey="votes" radius={[0, 6, 6, 0]}>
                {sorted.map((_, idx) => (
                  <Cell key={idx} fill={OPPOSED_PALETTE[idx % OPPOSED_PALETTE.length]} />
                ))}
                <LabelList dataKey="votes" position="right" className="fill-slate-600" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function ChartHeader({
  title,
  subtitle,
  totalLabel
}: {
  title: string;
  subtitle: string;
  totalLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">{subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
        {totalLabel}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="mt-10 text-center text-sm text-slate-500">
      No votes recorded yet — the chart will populate as ballots arrive.
    </p>
  );
}
