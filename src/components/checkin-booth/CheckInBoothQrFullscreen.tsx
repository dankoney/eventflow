"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useState } from "react";

import { QRScanner } from "@/components/checkin/QRScanner";
import { kioskBackButtonClass } from "@/components/checkin-booth/kioskClasses";

type CheckInBoothQrFullscreenProps = {
  busy: boolean;
  scanError: string | null;
  onBack: () => void;
  onScan: (qrPayload: string) => void;
};

/** Dedicated full-width QR scan step (guest taps “Scan QR code” from pre-registered). */
export function CheckInBoothQrFullscreen({ busy, scanError, onBack, onScan }: CheckInBoothQrFullscreenProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDecode = useCallback(
    (payload: string) => {
      if (busy) return;
      setLocalError(null);
      onScan(payload);
    },
    [busy, onScan]
  );

  const message = scanError ?? localError;

  return (
    <div className="flex h-full min-h-0 max-h-[calc(100dvh-2rem)] flex-col gap-5">
      <button type="button" onClick={onBack} disabled={busy} className={kioskBackButtonClass}>
        <ChevronLeft className="h-6 w-6" aria-hidden />
        Back
      </button>

      <div className="shrink-0 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0040e0]">Pre-registered</p>
        <h2 className="mt-2 text-2xl font-bold text-[#151c27] sm:text-4xl">Scan your QR code</h2>
        <p className="mx-auto mt-2 max-w-2xl text-base text-[#434656] sm:text-lg">
          Open the QR from your registration email on your phone and hold it up to the camera below.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#c4c5d9] bg-white p-4 shadow-sm sm:p-6">
        <QRScanner
          variant="fullscreen"
          autoStart
          disabled={busy}
          cooldownMs={3000}
          onDecode={handleDecode}
          onInvalidScan={() =>
            setLocalError("Not a valid guest QR. Use the code from your registration confirmation email.")
          }
        />
      </div>

      {busy ? (
        <p className="shrink-0 text-center text-lg font-semibold text-[#0040e0]">Checking you in…</p>
      ) : null}

      {message ? (
        <p
          className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center text-base text-red-700"
          role="alert"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
