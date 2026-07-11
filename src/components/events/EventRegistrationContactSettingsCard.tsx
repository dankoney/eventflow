"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { updateEventRegistrationContactSettings } from "@/lib/actions/event.actions";

type EventRegistrationContactSettingsCardProps = {
  eventId: string;
  readOnly?: boolean;
  initialEmailMandatoryForRegistration: boolean;
  /** When true, renders without outer card chrome (for nested advanced panels). */
  buried?: boolean;
};

export function EventRegistrationContactSettingsCard({
  eventId,
  readOnly = false,
  initialEmailMandatoryForRegistration,
  buried = false
}: EventRegistrationContactSettingsCardProps) {
  const router = useRouter();
  const [emailMandatory, setEmailMandatory] = useState(initialEmailMandatoryForRegistration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmailMandatory(initialEmailMandatoryForRegistration);
  }, [initialEmailMandatoryForRegistration]);

  const dirty = emailMandatory !== initialEmailMandatoryForRegistration;

  async function onSave() {
    setError(null);
    setBusy(true);
    const res = await updateEventRegistrationContactSettings({
      eventId,
      emailMandatoryForRegistration: emailMandatory
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not save.");
      return;
    }
    setEmailMandatory(res.data.emailMandatoryForRegistration);
    router.refresh();
  }

  return (
    <div
      className={
        buried
          ? "px-2 py-3"
          : "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      }
    >
      {!buried ? (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Registration</p>
          <h2 className="mt-2 text-base font-semibold text-slate-900">Contact field requirements</h2>
          <p className="mt-1 text-sm text-slate-600">
            Control whether guests must provide an email address when registering. Phone number is always required.
          </p>
        </div>
      ) : (
        <p className="mb-3 px-2 text-xs leading-relaxed text-zinc-500">
          Rarely changed. Affects all registration paths (public page, walk-in, import, and manual guest creation).
          Phone remains required; disabling email routes confirmations through SMS with a personal pass link.
        </p>
      )}
      <div className={buried ? "space-y-4 px-2" : "space-y-4 px-4 py-5 sm:px-6"}>
        {error ? (
          <WorkspaceNotice variant="error" onDismiss={() => setError(null)}>
            {error}
          </WorkspaceNotice>
        ) : null}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300"
            disabled={readOnly || busy}
            checked={emailMandatory}
            onChange={(e) => setEmailMandatory(e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-900">Make Email Mandatory for Registration</span>
            <span className="mt-1 block text-xs text-slate-600">
              When unchecked, guests can register with only a valid mobile number. Automated notifications route
              through SMS with direct links when no email is on file.
            </span>
          </span>
        </label>
        {!readOnly ? (
          <Button type="button" disabled={busy || !dirty} onClick={() => void onSave()}>
            {busy ? "Saving…" : "Save contact settings"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
