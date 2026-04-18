import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return <div className={cn("rounded-lg border bg-white p-4 shadow-sm", className)}>{children}</div>;
}
