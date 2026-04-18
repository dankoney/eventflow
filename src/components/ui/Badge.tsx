import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  className?: string;
};

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn("inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium", className)}>
      {children}
    </span>
  );
}
