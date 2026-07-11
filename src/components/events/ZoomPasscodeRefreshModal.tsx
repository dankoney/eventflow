"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { regenerateEventZoomCredentials } from "@/lib/actions/zoom.actions";
import { validateZoomPasscode } from "@/lib/zoom/passcode";

type Props = {
  eventId: string;
  open: boolean;
  onClose: () => void;
};

export function ZoomPasscodeRefreshModal({ eventId, open, onClose }: Props) {
  const [passcodeMode, setPasscodeMode] = useState<"default" | "custom">("default");
  const [customPasscode, setCustomPasscode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setFieldError(null);
    if (passcodeMode === "custom") {
      const v = validateZoomPasscode(customPasscode);
      if (!v.ok) {
        setFieldError(v.message);
        return;
      }
    }
    setBusy(true);
    const res = await regenerateEventZoomCredentials({
      eventId,
      passcodeMode,
      customPasscode: passcodeMode === "custom" ? customPasscode : undefined
    });
    setBusy(false);
    if (!res.success) {
      setFieldError(res.error ?? "Could not refresh passcode");
      return;
    }
    onClose();
    window.location.reload();
  }

  return (
    <Modal open={open} title="Refresh Zoom passcode" subtitle="Updates passcode and syncs join details from Zoom." onClose={onClose}>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="refresh-passcode-mode"
              checked={passcodeMode === "default"}
              onChange={() => {
                setPasscodeMode("default");
                setFieldError(null);
              }}
            />
            New Zoom-generated passcode
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="refresh-passcode-mode"
              checked={passcodeMode === "custom"}
              onChange={() => setPasscodeMode("custom")}
            />
            Set custom passcode
          </label>
        </div>
        {passcodeMode === "custom" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800">Custom passcode</label>
            <Input
              className="font-mono"
              maxLength={10}
              placeholder="No spaces — visible characters only"
              value={customPasscode}
              onChange={(e) => {
                setCustomPasscode(e.target.value);
                setFieldError(null);
              }}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Zoom allows visible ASCII only (letters, numbers, symbols). Spaces are not allowed.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            Eventflow will request a new numeric passcode from Zoom and update the join link immediately.
          </p>
        )}
        {fieldError ? (
          <p className="text-sm text-red-700" role="alert">
            {fieldError}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={busy}>
            <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
            {busy ? "Refreshing…" : "Refresh passcode"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
