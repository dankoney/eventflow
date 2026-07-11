"use client";

import { Check } from "lucide-react";

import { formatBoothCheckInTime } from "@/components/checkin-booth/formatBoothCheckInTime";
import { kioskPrimaryButtonClass } from "@/components/checkin-booth/kioskClasses";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type CheckInBoothSuccessProps = {
  eventName: string;
  guestName: string;
  checkedInAt: string;
  detail?: string | null;
  onNextGuest: () => void;
};

export function CheckInBoothSuccess({
  eventName,
  guestName,
  checkedInAt,
  detail,
  onNextGuest
}: CheckInBoothSuccessProps) {
  const timeLabel = formatBoothCheckInTime(checkedInAt);

  return (
    <div className="mx-auto max-w-xl space-y-8 rounded-2xl border border-emerald-200 bg-white p-10 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
        <Check className="h-12 w-12" strokeWidth={2.5} aria-hidden />
      </div>
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800/80">Checked in</p>
        <h2 className="mt-3 text-3xl font-bold text-emerald-950 sm:text-4xl">{guestName}</h2>
        <p className="mt-3 text-base text-emerald-900/90 sm:text-lg">Welcome to {eventName}. You&apos;re all set.</p>
        <p className="mt-2 text-sm text-emerald-800/80">Signed in at {timeLabel}</p>
        {detail ? (
          <p className="mx-auto mt-3 max-w-md text-sm text-emerald-900/90">{detail}</p>
        ) : null}
      </div>
      <Button
        type="button"
        className={cn(kioskPrimaryButtonClass, "mx-auto max-w-md bg-[#0040e0] hover:bg-[#0035be]")}
        onClick={onNextGuest}
      >
        Next guest
      </Button>
      <p className="text-sm text-emerald-800/70">This screen resets automatically in a few seconds.</p>
    </div>
  );
}
