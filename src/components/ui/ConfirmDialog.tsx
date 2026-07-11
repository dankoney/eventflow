"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styling for destructive actions. */
  variant?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="md" headerTone="dark">
      <p className="text-sm leading-relaxed text-zinc-600">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end sm:gap-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full border-zinc-200 sm:w-auto"
          disabled={busy}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          disabled={busy}
          className={cn(
            "w-full font-semibold sm:w-auto",
            variant === "danger"
              ? "bg-red-600 text-white hover:bg-red-500"
              : "bg-zinc-900 text-white hover:bg-zinc-800"
          )}
          onClick={onConfirm}
        >
          {busy ? "Please wait…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
