import { X } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkspaceNoticeVariant = "success" | "error" | "info";

const variantClass: Record<WorkspaceNoticeVariant, string> = {
  success: "border-emerald-200/90 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-100",
  error: "border-red-200/90 bg-red-50 text-red-950 ring-1 ring-red-100",
  info: "border-amber-200/90 bg-amber-50 text-amber-950 ring-1 ring-amber-100"
};

type WorkspaceNoticeProps = {
  variant: WorkspaceNoticeVariant;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
};

export function WorkspaceNotice({ variant, children, className, onDismiss }: WorkspaceNoticeProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border px-4 py-3 pr-10 text-sm leading-relaxed shadow-sm",
        variantClass[variant],
        className
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-current opacity-70 transition hover:bg-black/5 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {children}
    </div>
  );
}
