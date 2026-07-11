"use client";

import { EventType } from "@prisma/client";
import { useState } from "react";

import { FeedbackPortalPhoneField } from "@/components/feedback/FeedbackPortalPhoneField";
import { Button } from "@/components/ui/Button";
import { feedbackPortalCredentialHint } from "@/lib/event-feedback/portalCopy";
import type { PhoneDialOption } from "@/lib/register/phoneDialOptions";
import { cn } from "@/lib/utils";

type LinkMethod = "email" | "phone";

type Props = {
  eventType: EventType;
  phoneDialOptions: PhoneDialOption[];
  accent?: string;
  busy: boolean;
  error: string | null;
  onAnonymous: () => void;
  onLink: (input: { email?: string; phoneDialCode?: string; phoneNational?: string }) => void;
  onBack: () => void;
};

export function FeedbackSubmitIdentityStep({
  eventType,
  phoneDialOptions,
  accent = "#0f172a",
  busy,
  error,
  onAnonymous,
  onLink,
  onBack
}: Props) {
  const [method, setMethod] = useState<LinkMethod>("phone");
  const [email, setEmail] = useState("");
  const [dialCode, setDialCode] = useState(phoneDialOptions[0]?.value ?? "233");
  const [national, setNational] = useState("");

  function handleLinkSubmit() {
    if (method === "email") {
      onLink({ email: email.trim() });
      return;
    }
    onLink({ phoneDialCode: dialCode, phoneNational: national.trim() });
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-zinc-900">Almost done</h3>
        <p className="mt-1 text-sm text-zinc-600">Choose how to save your feedback.</p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onAnonymous}
        className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {busy ? "Saving…" : "Submit anonymously"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-zinc-200" />
        </div>
        <p className="relative mx-auto w-fit bg-white px-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
          or link to registration
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex gap-2">
          {(["phone", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => setMethod(m)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
                method === m
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              {m === "email" ? "Email" : "Phone"}
            </button>
          ))}
        </div>

        {method === "email" ? (
          <input
            type="email"
            autoComplete="email"
            disabled={busy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
        ) : (
          <FeedbackPortalPhoneField
            dialOptions={phoneDialOptions}
            dialCode={dialCode}
            national={national}
            onDialCodeChange={setDialCode}
            onNationalChange={setNational}
            disabled={busy}
          />
        )}

        <p className="text-xs text-zinc-500">{feedbackPortalCredentialHint(eventType)}</p>

        <Button type="button" className="w-full" disabled={busy} onClick={handleLinkSubmit}>
          {busy ? "Saving…" : "Link and submit"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={onBack}
        className="w-full text-center text-sm font-medium text-zinc-500 hover:text-zinc-800"
      >
        Back to feedback
      </button>
    </div>
  );
}
