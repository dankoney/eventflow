import { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

export function StatCard({ title, value, description, icon, className }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {description ? <p className="text-xs text-slate-500">{description}</p> : null}
    </Card>
  );
}
