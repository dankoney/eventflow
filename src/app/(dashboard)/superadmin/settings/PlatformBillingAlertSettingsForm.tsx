"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { updatePlatformBillingAlertSettingsAction } from "@/lib/actions/platformSettings.actions";
import { cn } from "@/lib/utils";

type Props = {
  initialSupportEmail: string;
  initialBillingAlertCcEmailsText: string;
};

export function PlatformBillingAlertSettingsForm({
  initialSupportEmail,
  initialBillingAlertCcEmailsText
}: Props) {
  const [supportEmail, setSupportEmail] = useState(initialSupportEmail);
  const [ccText, setCcText] = useState(initialBillingAlertCcEmailsText);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updatePlatformBillingAlertSettingsAction({
        supportEmail: supportEmail.trim() || null,
        billingAlertCcEmailsText: ccText
      });
      if (!res.success) {
        setError(res.error ?? "Unable to save settings.");
        return;
      }
      setSupportEmail(res.data?.supportEmail ?? "");
      setCcText((res.data?.billingAlertCcEmails ?? []).join("\n"));
      setSuccess("Saved. PRO and Enterprise due alerts will BCC these addresses.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="support-email"
          className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
        >
          Support / billing contact email
        </label>
        <input
          id="support-email"
          type="email"
          className={cn(
            "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
            "outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          )}
          placeholder="support@yourdomain.com"
          value={supportEmail}
          onChange={(e) => setSupportEmail(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          Shown in customer billing emails (mailto / “contact support”). Not hardcoded in the app.
        </p>
      </div>

      <div>
        <label
          htmlFor="billing-alert-cc"
          className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
        >
          Billing due-alert BCC list
        </label>
        <textarea
          id="billing-alert-cc"
          rows={5}
          className={cn(
            "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900",
            "outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          )}
          placeholder={"owner@yourdomain.com\nsupport@yourdomain.com"}
          value={ccText}
          onChange={(e) => setCcText(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          One email per line (or comma-separated). Blind-copied on PRO trial reminders, Enterprise
          coverage reminders (T−30…T−1), and card-expiring alerts. Hidden from the customer{" "}
          <span className="font-medium">To</span> recipient.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save alert settings"}
      </Button>
    </form>
  );
}
