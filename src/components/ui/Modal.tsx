import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  /** Optional line under the title (e.g. context). */
  subtitle?: string;
  onClose?: () => void;
  children: ReactNode;
  /** Pinned action bar below scrollable body. */
  footer?: ReactNode;
  /** Dialog max width on large screens. */
  size?: "md" | "lg" | "xl";
  /**
   * Dark header bar on an otherwise light dialog (dashboard wizards).
   * Does not use public-page CSS variables — only {@link tone}="dark" does.
   */
  headerTone?: "light" | "dark";
  /** Full dialog chrome: light (default) or dark (Night Edition public pages). */
  tone?: "light" | "dark";
};

const sizeClass: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl"
};

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  headerTone = "light",
  tone = "light"
}: ModalProps) {
  if (!open) return null;

  const fullDark = tone === "dark";
  const darkHeader = headerTone === "dark" && !fullDark;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-zinc-950/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
      onKeyDown={undefined}
    >
      <div
        className={cn(
          "relative isolate flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-h-[min(90dvh,calc(100vh-2rem))] sm:rounded-2xl",
          fullDark
            ? "border border-white/10 bg-[var(--pe-surface-container)] shadow-[0_0_60px_rgba(255,169,249,0.12)]"
            : "border-2 border-zinc-900 bg-white shadow-[8px_8px_0_0_rgb(24_24_27)]",
          sizeClass[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-3 px-4 py-4 sm:px-6",
            fullDark
              ? "border-b border-white/10 bg-[var(--pe-surface-container-high)]"
              : darkHeader
                ? "border-b border-zinc-800 bg-zinc-950"
                : "border-b border-zinc-100 bg-zinc-50"
          )}
        >
          <div className="min-w-0">
            <h3
              id="modal-title"
              className={cn(
                "text-lg font-bold tracking-tight",
                fullDark || darkHeader ? "text-white" : "text-zinc-900"
              )}
            >
              {title}
            </h3>
            {subtitle ? (
              <p
                className={cn(
                  "mt-1 text-sm",
                  fullDark
                    ? "text-[var(--pe-on-surface-variant)]"
                    : darkHeader
                      ? "text-zinc-400"
                      : "text-zinc-600"
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              fullDark || darkHeader
                ? "text-zinc-400 hover:bg-white/10 hover:text-white"
                : "text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900"
            )}
          >
            Close
          </button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-5",
            footer ? "overflow-hidden" : "overflow-y-auto overscroll-contain",
            fullDark ? "bg-[var(--pe-surface-container)]" : "bg-white"
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              "shrink-0 border-t px-4 py-3 sm:px-6",
              fullDark
                ? "border-white/10 bg-[var(--pe-surface-container-high)]"
                : "border-zinc-200 bg-zinc-50"
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
