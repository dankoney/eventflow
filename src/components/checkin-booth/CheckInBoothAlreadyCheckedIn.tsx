"use client";

import { ShieldAlert } from "lucide-react";

import {
  alreadySignedInChannelMessage,
  formatBoothCheckInTime,
  type BoothCheckInChannel
} from "@/components/checkin-booth/formatBoothCheckInTime";
import { kioskPrimaryButtonClass } from "@/components/checkin-booth/kioskClasses";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type CheckInBoothAlreadyCheckedInProps = {
  eventName: string;
  guestName: string;
  checkedInAt: string;
  channel: BoothCheckInChannel;
  onNextGuest: () => void;
};

/** Distinct outcome when credentials match a guest who is already checked in (not a new check-in). */
export function CheckInBoothAlreadyCheckedIn({
  eventName,
  guestName,
  checkedInAt,
  channel,
  onNextGuest
}: CheckInBoothAlreadyCheckedInProps) {
  const timeLabel = formatBoothCheckInTime(checkedInAt);

  return (
    <div className="mx-auto max-w-xl space-y-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-10 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-500 text-white shadow-md">
        <ShieldAlert className="h-12 w-12" strokeWidth={2.25} aria-hidden />
      </div>
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-900/80">Already signed in</p>
        <h2 className="mt-3 text-3xl font-bold text-amber-950 sm:text-4xl">{guestName}</h2>
        <p className="mt-4 text-base leading-relaxed text-amber-950/90 sm:text-lg">
          {alreadySignedInChannelMessage(channel)}
        </p>
        <p className="mt-2 text-base font-medium text-amber-900">
          Checked in at {timeLabel} for {eventName}.
        </p>
        <p className="mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-amber-950">
          No new check-in was recorded. If you are not {guestName.split(" ")[0] ?? "this guest"}, please see event
          staff — do not use someone else&apos;s email, phone, or QR code.
        </p>
      </div>
      <Button
        type="button"
        className={cn(kioskPrimaryButtonClass, "mx-auto max-w-md bg-amber-800 hover:bg-amber-900")}
        onClick={onNextGuest}
      >
        Next guest
      </Button>
      <p className="text-sm text-amber-800/70">This screen resets automatically in a few seconds.</p>
    </div>
  );
}
