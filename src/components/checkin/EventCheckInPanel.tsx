"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  checkInGuestById,
  checkInGuestByQr,
  type CheckInResult
} from "@/lib/actions/checkin.actions";
import type { RecentCheckInRow } from "@/lib/db/checkins";
import type { ActionResult } from "@/types";

import { CheckInSearch } from "./CheckInSearch";
import { QRScanner } from "./QRScanner";
import { RecentActivity } from "./RecentActivity";

type EventCheckInPanelProps = {
  eventId: string;
  initialRecent: RecentCheckInRow[];
};

export function EventCheckInPanel({ eventId, initialRecent }: EventCheckInPanelProps) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleResult = useCallback(
    async (promise: Promise<ActionResult<CheckInResult>>) => {
      setBanner(null);
      setBusy(true);
      const res = await promise;
      setBusy(false);
      if (!res.success || !res.data) {
        setBanner({ tone: "err", text: res.error ?? "Something went wrong." });
        return;
      }
      const { guest, alreadyCheckedIn } = res.data;
      setBanner({
        tone: "ok",
        text: alreadyCheckedIn
          ? `${guest.name} was already checked in.`
          : `Checked in ${guest.name}.`
      });
      router.refresh();
    },
    [router]
  );

  const onQr = useCallback(
    (payload: string) => {
      void handleResult(checkInGuestByQr({ eventId, qrPayload: payload }));
    },
    [eventId, handleResult]
  );

  const onPickGuest = useCallback(
    (guestId: string) => {
      void handleResult(checkInGuestById({ eventId, guestId, method: "manual" }));
    },
    [eventId, handleResult]
  );

  return (
    <div className="space-y-6">
      {banner ? (
        <div
          role="status"
          className={
            banner.tone === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <QRScanner onDecode={onQr} />
        <CheckInSearch eventId={eventId} onPickGuest={onPickGuest} disabled={busy} />
      </div>

      <RecentActivity entries={initialRecent} />
    </div>
  );
}
