"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { sendManualEventReminders } from "@/lib/actions/reminder.actions";

type EventManualReminderSendProps = {
  eventId: string;
  /** Saved on server — save the form before sending so channels match what you expect. */
  primaryReminderEnabled: boolean;
  finalReminderEnabled: boolean;
};

export function EventManualReminderSend({
  eventId,
  primaryReminderEnabled,
  finalReminderEnabled
}: EventManualReminderSendProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(which: "primary" | "final" | "both") {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await sendManualEventReminders({ eventId, which });
      if (!res.success) {
        setError(res.error ?? "Send failed.");
        return;
      }
      const d = res.data;
      const parts: string[] = [];
      if (d?.primary) parts.push("primary");
      if (d?.final) parts.push("final");
      setMessage(
        parts.length
          ? `Sent ${parts.join(" & ")} reminder(s) now. Scheduled cron reminders are unchanged.`
          : "Done."
      );
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Send now</h4>
      <p className="text-xs text-slate-600">
        Uses the <span className="font-medium text-slate-800">saved</span> reminder toggles and channels on the server.
        Does not mark the automated reminder as sent — cron will still run at the scheduled time.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !primaryReminderEnabled}
          title={
            primaryReminderEnabled
              ? undefined
              : "Enable “Primary reminder” above and save before sending."
          }
          onClick={() => run("primary")}
        >
          {pending ? "Sending…" : "Send primary now"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !finalReminderEnabled}
          title={
            finalReminderEnabled
              ? undefined
              : "Enable “Final reminder” above and save before sending."
          }
          onClick={() => run("final")}
        >
          {pending ? "Sending…" : "Send final now"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !primaryReminderEnabled || !finalReminderEnabled}
          title={
            primaryReminderEnabled && finalReminderEnabled
              ? undefined
              : "Enable both reminder blocks above and save to send both."
          }
          onClick={() => run("both")}
        >
          {pending ? "Sending…" : "Send both now"}
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
