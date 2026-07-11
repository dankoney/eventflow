"use client";

import { Check, Copy, Loader2, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { regenerateActivationLink } from "@/lib/actions/platform.actions";

type Props = { orgId: string };

/**
 * Inline action for pending workspaces. Mints a fresh activation token (the
 * server action burns any prior unconsumed token), re-sends the email, and
 * exposes the raw URL so the platform owner can copy it directly if the email
 * is unreachable.
 */
export function RegenerateActivationButton({ orgId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleResend() {
    setEmailError(null);
    startTransition(async () => {
      const res = await regenerateActivationLink({ orgId });
      if (!res.success || !res.data) {
        setEmailError(res.error ?? "Could not regenerate the link.");
        return;
      }
      setLastUrl(res.data.activationUrl);
      setEmailSent(res.data.emailSent);
      if (res.data.emailError) setEmailError(res.data.emailError);
      router.refresh();
    });
  }

  async function copy() {
    if (!lastUrl) return;
    try {
      await navigator.clipboard.writeText(lastUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={handleResend}
        disabled={pending}
        variant="secondary"
        className="inline-flex items-center gap-1.5 text-xs"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
        )}
        {pending ? "Sending…" : "Resend activation"}
      </Button>
      {lastUrl ? (
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" aria-hidden /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" aria-hidden /> Copy link
            </>
          )}
        </button>
      ) : null}
      {emailSent === true ? (
        <span className="text-[11px] text-emerald-700">Email sent</span>
      ) : null}
      {emailSent === false ? (
        <span className="text-[11px] text-amber-700">
          Email failed — share the copied link directly.
        </span>
      ) : null}
      {emailError ? (
        <span className="text-[11px] text-rose-700">{emailError}</span>
      ) : null}
    </div>
  );
}
