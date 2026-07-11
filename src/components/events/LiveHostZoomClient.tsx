"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getZoomHostLaunchPayload } from "@/lib/actions/zoom.actions";
import { Button } from "@/components/ui/Button";
import { formatZoomMeetingSdkJoinError } from "@/lib/zoom/meetingSdkJoin";

type Props = {
  eventId: string;
  eventName: string;
  backHref: string;
};

type JoinErrorState = {
  message: string;
  hints: string[];
  credentialMismatchWarning: string | null;
};

export function LiveHostZoomClient({ eventId, eventName, backHref }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<JoinErrorState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const res = await getZoomHostLaunchPayload({ eventId });
      if (cancelled) return;
      if (!res.success || !res.data) {
        setError({
          message: res.error ?? "Could not start host session",
          hints: [
            "Configure Meeting SDK Client ID and Client Secret under Settings → Integrations → Zoom.",
            'Use "Open in Zoom app" on the event page as a fallback.'
          ],
          credentialMismatchWarning: null
        });
        setLoading(false);
        return;
      }
      const launch = res.data;
      try {
        const ZoomMtgEmbedded = (await import("@zoom/meetingsdk/embedded")).default;
        if (cancelled || !rootRef.current) return;
        const client = ZoomMtgEmbedded.createClient();
        await client.init({
          zoomAppRoot: rootRef.current,
          language: "en-US",
          patchJsMedia: true,
          leaveOnPageUnload: true,
          ...(process.env.NODE_ENV === "development" ? { debug: true } : {})
        });
        await new Promise<void>((resolve, reject) => {
          client.join({
            signature: launch.signature,
            meetingNumber: launch.meetingNumber,
            password: launch.password,
            userName: launch.userName,
            userEmail: launch.userEmail || undefined,
            zak: launch.zak,
            success: () => resolve(),
            error: (err: unknown) => reject(err)
          });
        });
        if (cancelled) return;
        setLoading(false);
        client.on("connection-change", (payload: { state?: string }) => {
          if (payload?.state === "Closed" || payload?.state === "Fail") {
            router.push(backHref);
          }
        });
      } catch (e) {
        const formatted = formatZoomMeetingSdkJoinError(e, {
          oauthClientId: launch.oauthClientId,
          meetingSdkClientId: launch.sdkKey
        });
        setError({
          message: formatted.message,
          hints: formatted.hints,
          credentialMismatchWarning: launch.credentialMismatchWarning
        });
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [eventId, backHref, router]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">Host session</p>
          <h1 className="truncate text-sm font-semibold">{eventName}</h1>
        </div>
        <Link href={backHref}>
          <Button type="button" variant="secondary" className="text-xs">
            Exit
          </Button>
        </Link>
      </header>
      {error ? (
        <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
          <p className="text-sm text-red-300" role="alert">
            {error.message}
          </p>
          {error.credentialMismatchWarning ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-950/50 px-3 py-2 text-left text-xs text-amber-100">
              {error.credentialMismatchWarning}
            </p>
          ) : null}
          <ul className="space-y-2 text-left text-xs text-zinc-400">
            {error.hints.map((hint) => (
              <li key={hint} className="list-disc pl-4">
                {hint}
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            Since March 2026, Zoom requires JWT + ZAK for host start, and OBF tokens when the Meeting SDK app joins
            meetings outside its account. See{" "}
            <a
              href="https://developers.zoom.us/docs/meeting-sdk/obf-faq/"
              className="text-violet-300 underline"
              target="_blank"
              rel="noreferrer"
            >
              Zoom Meeting SDK authorization FAQ
            </a>
            .
          </p>
          <Link href={backHref} className="inline-block text-sm font-medium text-violet-300 underline">
            Back to event
          </Link>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">Connecting to Zoom…</p>
          ) : null}
          <div ref={rootRef} className="min-h-0 flex-1" />
        </>
      )}
    </div>
  );
}
