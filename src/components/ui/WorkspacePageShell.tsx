import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkspacePageShellProps = {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Body has vertical padding only (for full-width grids inside). */
  bodyFlush?: boolean;
  /**
   * When false, outer card does not clip with overflow-hidden so inner min-w-0 + overflow-x-auto can show horizontal scroll (e.g. wide CRM table).
   */
  clipContent?: boolean;
  /**
   * Use `h2` under layouts that already expose an `h1` (e.g. event command header).
   */
  titleLevel?: "h1" | "h2";
};

/**
 * Primary workspace frame: matches the events list “Events workspace” card
 * (rounded-2xl border, gradient header strip, consistent body padding).
 */
export function WorkspacePageShell({
  kicker,
  title,
  description,
  headerActions,
  children,
  className,
  bodyFlush = false,
  clipContent = true,
  titleLevel = "h1"
}: WorkspacePageShellProps) {
  const TitleTag = titleLevel === "h2" ? "h2" : "h1";
  const titleClass =
    "text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl";

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-900/[0.04]",
        clipContent ? "overflow-hidden" : "overflow-x-auto",
        className
      )}
    >
      <div className="border-b border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-zinc-100/70 px-5 py-5 sm:px-8 sm:py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">{kicker}</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <TitleTag className={titleClass}>{title}</TitleTag>
            {description ? (
              <div className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">{description}</div>
            ) : null}
          </div>
          {headerActions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div> : null}
        </div>
      </div>
      <div
        className={cn(
          "min-w-0 max-w-full",
          bodyFlush ? "space-y-6 py-6 sm:space-y-8 sm:py-8" : "space-y-6 px-5 py-6 sm:space-y-8 sm:px-8 sm:py-8"
        )}
      >
        {children}
      </div>
    </div>
  );
}
