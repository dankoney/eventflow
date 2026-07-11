"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type WorkspaceToastVariant = "success" | "info" | "error";

export type WorkspaceToastState = {
  variant: WorkspaceToastVariant;
  message: string;
} | null;

const variantClass: Record<WorkspaceToastVariant, string> = {
  success: "border-emerald-200/90 bg-emerald-50 text-emerald-950 shadow-lg shadow-emerald-900/10",
  info: "border-sky-200/90 bg-sky-50 text-sky-950 shadow-lg shadow-sky-900/10",
  error: "border-red-200/90 bg-red-50 text-red-950 shadow-lg shadow-red-900/10"
};

type WorkspaceToastProps = {
  toast: WorkspaceToastState;
  onDismiss: () => void;
  durationMs?: number;
};

export function WorkspaceToast({ toast, onDismiss, durationMs = 7000 }: WorkspaceToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 sm:justify-end sm:px-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto relative flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 pr-10 text-sm leading-relaxed",
          variantClass[toast.variant]
        )}
      >
        <p className="font-medium">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
