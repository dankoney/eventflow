import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TableProps = {
  headers: string[];
  children: ReactNode;
  className?: string;
  /** `workspace`: stronger border, zinc header — matches event / guest consoles. */
  variant?: "default" | "workspace";
};

export function Table({ headers, children, className, variant = "default" }: TableProps) {
  const workspace = variant === "workspace";

  return (
    <div
      className={cn(
        "overflow-hidden bg-white",
        workspace
          ? "rounded-xl border-2 border-zinc-200 shadow-sm shadow-zinc-900/5"
          : "rounded-lg border border-slate-200",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              workspace ? "bg-zinc-50 text-zinc-600" : "bg-slate-50 text-slate-600"
            )}
          >
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={workspace ? "divide-y divide-zinc-100 text-zinc-800" : undefined}>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
