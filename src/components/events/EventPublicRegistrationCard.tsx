"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { updateEventPublicRegistrationSettings } from "@/lib/actions/event.actions";

type EventPublicRegistrationCardProps = {
  eventId: string;
  readOnly?: boolean;
  initialAllowPublicRegistration: boolean;
  initialEnableSavedProfileLookup: boolean;
  /** Optional pre-rendered absolute URL to `/register/[eventId]` so admins see what they're opening up. */
  publicRegisterUrl?: string | null;
};

export function EventPublicRegistrationCard({
  eventId,
  readOnly = false,
  initialAllowPublicRegistration,
  initialEnableSavedProfileLookup,
  publicRegisterUrl
}: EventPublicRegistrationCardProps) {
  const router = useRouter();
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(initialAllowPublicRegistration);
  const [enableSavedProfileLookup, setEnableSavedProfileLookup] = useState(initialEnableSavedProfileLookup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllowPublicRegistration(initialAllowPublicRegistration);
  }, [initialAllowPublicRegistration]);

  useEffect(() => {
    setEnableSavedProfileLookup(initialEnableSavedProfileLookup);
  }, [initialEnableSavedProfileLookup]);

  const dirty =
    allowPublicRegistration !== initialAllowPublicRegistration ||
    enableSavedProfileLookup !== initialEnableSavedProfileLookup;

  async function onSave() {
    setError(null);
    setBusy(true);
    const res = await updateEventPublicRegistrationSettings({
      eventId,
      allowPublicRegistration,
      enableSavedProfileLookup
    });
    setBusy(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not save.");
      return;
    }
    setAllowPublicRegistration(res.data.allowPublicRegistration);
    setEnableSavedProfileLookup(res.data.enableSavedProfileLookup);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Public registration</p>
        <h2 className="mt-2 text-base font-semibold text-slate-900">Self-registration page</h2>
        <p className="mt-1 text-sm text-slate-600">
          Controls the <span className="font-medium text-slate-800">/register</span> link and optional CRM profile
          lookup on the registration form.
        </p>
      </div>
      <div className="space-y-4 px-4 py-5 sm:px-6">
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
            checked={allowPublicRegistration}
            onChange={(e) => setAllowPublicRegistration(e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-900">Allow public self-registration</span>
            <span className="mt-1 block text-xs text-slate-600">
              Turn off for invite-only programs — only guests added by your team (or via an invitation link) can
              register.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300"
            disabled={readOnly || busy}
            checked={enableSavedProfileLookup}
            onChange={(e) => setEnableSavedProfileLookup(e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-900">Show &quot;Load my saved profile&quot;</span>
            <span className="mt-1 block text-xs text-slate-600">
              When on, returning guests and CRM contacts can look up their details by email and/or mobile before
              completing the form.
            </span>
          </span>
        </label>
        {publicRegisterUrl ? (
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Public link: </span>
            <a
              href={publicRegisterUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-slate-800 underline-offset-2 hover:underline"
            >
              {publicRegisterUrl}
            </a>
          </div>
        ) : null}
        {!readOnly ? (
          <Button type="button" disabled={busy || !dirty} onClick={() => void onSave()}>
            {busy ? "Saving…" : "Save registration settings"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
