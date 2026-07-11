"use client";

import { GuestStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  checkInGuestById,
  checkInGuestByQr,
  type CheckInResult
} from "@/lib/actions/checkin.actions";
import type { CheckInsPageResult } from "@/lib/db/checkins";
import {
  enqueueOfflineCheckIn,
  getGuestCache,
  listQueuedForEvent,
  putGuestCache,
  removeQueueItem,
  updateCachedGuestStatus,
  type CachedGuestRow
} from "@/lib/checkin-offline-db";
import type { ActionResult } from "@/types";

import { CheckInSearch } from "./CheckInSearch";
import { QRScanner } from "./QRScanner";
import { RecentCheckInsPanel } from "./RecentCheckInsPanel";
import { StaffWalkInForm } from "./StaffWalkInForm";

const QR_HEX = /^[a-f0-9]{64}$/;

type EventCheckInPanelProps = {
  eventId: string;
  canManageCheckInRoster: boolean;
  canRegisterStaffWalkIn: boolean;
  emailMandatoryForRegistration: boolean;
  initialCheckIns: CheckInsPageResult;
  initialGuestCache: CachedGuestRow[];
};

export function EventCheckInPanel({
  eventId,
  canManageCheckInRoster,
  canRegisterStaffWalkIn,
  emailMandatoryForRegistration,
  initialCheckIns,
  initialGuestCache
}: EventCheckInPanelProps) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ tone: "ok" | "err" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [guestRows, setGuestRows] = useState<CachedGuestRow[]>(initialGuestCache);

  const flushQueued = useCallback(async () => {
    const pending = await listQueuedForEvent(eventId);
    if (pending.length === 0) return;
    let synced = 0;
    const errors: string[] = [];
    for (const row of pending) {
      const res = await checkInGuestById({
        eventId,
        guestId: row.guestId,
        method: row.method
      });
      if (res.success) {
        synced += 1;
        await removeQueueItem(row.id);
      } else {
        errors.push(res.error ?? "Failed");
      }
    }
    if (synced > 0) {
      setBanner({
        tone: errors.length ? "warn" : "ok",
        text:
          errors.length > 0
            ? `Synced ${synced} offline check-in(s). ${errors.length} still pending (retry when online).`
            : `Synced ${synced} offline check-in(s).`
      });
      router.refresh();
    }
  }, [eventId, router]);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (online) void flushQueued();
  }, [online, flushQueued]);

  useEffect(() => {
    setGuestRows(initialGuestCache);
    void putGuestCache(eventId, initialGuestCache);
  }, [eventId, initialGuestCache]);

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
      await updateCachedGuestStatus(eventId, guest.id, guest.status);
      const cached = await getGuestCache(eventId);
      if (cached) setGuestRows(cached);
      router.refresh();
    },
    [eventId, router]
  );

  const offlineCheckIn = useCallback(
    async (guestId: string, method: "qr" | "manual") => {
      const row = guestRows.find((g) => g.id === guestId);
      if (!row) {
        setBanner({
          tone: "err",
          text: "Guest not found in offline cache. Reconnect once to refresh the list."
        });
        return;
      }
      if (row.status === GuestStatus.CHECKED_IN || row.status === GuestStatus.JOINED) {
        setBanner({ tone: "ok", text: `${row.name} was already checked in.` });
        return;
      }
      await enqueueOfflineCheckIn(eventId, guestId, method);
      await updateCachedGuestStatus(eventId, guestId, GuestStatus.CHECKED_IN);
      const cached = await getGuestCache(eventId);
      if (cached) setGuestRows(cached);
      setBanner({
        tone: "warn",
        text: `Saved offline: ${row.name} will sync when you are back online.`
      });
    },
    [eventId, guestRows]
  );

  const onQr = useCallback(
    (payload: string) => {
      const raw = payload.trim();
      if (!online) {
        if (!QR_HEX.test(raw)) {
          setBanner({ tone: "err", text: "Invalid QR code." });
          return;
        }
        const match = guestRows.find((g) => g.qrCode === raw);
        if (!match) {
          setBanner({ tone: "err", text: "No guest matches this QR in your offline list." });
          return;
        }
        void offlineCheckIn(match.id, "qr");
        return;
      }
      void handleResult(checkInGuestByQr({ eventId, qrPayload: payload }));
    },
    [eventId, guestRows, handleResult, offlineCheckIn, online]
  );

  const onPickGuest = useCallback(
    (guestId: string) => {
      if (!online) {
        void offlineCheckIn(guestId, "manual");
        return;
      }
      void handleResult(checkInGuestById({ eventId, guestId, method: "manual" }));
    },
    [eventId, handleResult, offlineCheckIn, online]
  );

  return (
    <div className="space-y-6">
      {!online ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          You are offline. Search and check-in use a cached guest list; changes sync automatically when the connection
          returns.
        </div>
      ) : null}

      {banner ? (
        <div
          role="status"
          className={
            banner.tone === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : banner.tone === "warn"
                ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <QRScanner onDecode={onQr} disabled={busy} />
        <CheckInSearch guests={guestRows} onCheckIn={onPickGuest} disabled={busy} />
      </div>

      {canRegisterStaffWalkIn ? (
        <StaffWalkInForm
          eventId={eventId}
          emailMandatory={emailMandatoryForRegistration}
          disabled={busy}
        />
      ) : null}

      <RecentCheckInsPanel
        eventId={eventId}
        canManageRoster={canManageCheckInRoster}
        initial={initialCheckIns}
        className="border-0 p-0 shadow-none"
      />
    </div>
  );
}
