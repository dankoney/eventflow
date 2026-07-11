"use client";

import jsQR from "jsqr";
import { Camera, CameraOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { validateGuestQrCode } from "@/lib/qr";
import { cn } from "@/lib/utils";

type QRScannerProps = {
  onDecode: (payload: string) => void;
  /** Minimum ms between emitting the same payload again (default 2500). */
  cooldownMs?: number;
  disabled?: boolean;
  /** Start camera when the component mounts (kiosk self-scan). */
  autoStart?: boolean;
  /** Kiosk booth: larger controls; fullscreen: wide camera for self-scan page. */
  variant?: "default" | "kiosk" | "fullscreen";
  /** Called when a QR was read but is not a valid guest payload. */
  onInvalidScan?: () => void;
};

export function QRScanner({
  onDecode,
  cooldownMs = 2500,
  disabled,
  autoStart = false,
  variant = "default",
  onInvalidScan
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEmitRef = useRef<{ payload: string; at: number } | null>(null);
  const lastInvalidRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isKiosk = variant === "kiosk";
  const isFullscreen = variant === "fullscreen";

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setRunning(false);
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w < 10 || h < 10) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });
    if (code?.data && !disabled) {
      const raw = code.data.trim();
      if (validateGuestQrCode(raw)) {
        const now = Date.now();
        const last = lastEmitRef.current;
        if (!last || last.payload !== raw || now - last.at > cooldownMs) {
          lastEmitRef.current = { payload: raw, at: now };
          onDecode(raw);
        }
      } else {
        const now = Date.now();
        if (onInvalidScan && now - lastInvalidRef.current > 2000) {
          lastInvalidRef.current = now;
          onInvalidScan();
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [cooldownMs, disabled, onDecode, onInvalidScan]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError(
        isKiosk || isFullscreen
          ? "Camera unavailable. Allow camera access or check in with email or mobile."
          : "Camera permission denied or unavailable. Use manual search below."
      );
      setRunning(false);
    }
  }, [isFullscreen, isKiosk, tick]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if ((autoStart || isFullscreen) && !disabled) {
      void startCamera();
    }
  }, [autoStart, disabled, isFullscreen, startCamera]);

  if (isFullscreen) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col">
        {error ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-base text-amber-900" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className={cn(
            "relative w-full flex-1 overflow-hidden rounded-2xl bg-black",
            running ? "min-h-[min(62dvh,520px)]" : "flex min-h-[min(62dvh,520px)] items-center justify-center"
          )}
        >
          <video ref={videoRef} className={cn("h-full w-full object-cover", !running && "hidden")} playsInline muted />
          {!running ? (
            <span className="px-6 text-center text-lg text-slate-300">Starting camera…</span>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-4 border-white/60" aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
                <span className="rounded-full bg-black/55 px-5 py-2 text-base font-medium text-white">
                  Hold your QR inside the frame
                </span>
              </div>
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {!autoStart ? (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              disabled={disabled}
              onClick={running ? stopCamera : startCamera}
              className={cn(
                "min-h-12 rounded-xl px-6 text-base font-semibold",
                running ? "bg-slate-200 text-slate-900" : "bg-[#0040e0] text-white hover:bg-[#0035be]"
              )}
            >
              {running ? (
                <>
                  <CameraOff className="mr-2 inline h-5 w-5" aria-hidden />
                  Stop camera
                </>
              ) : (
                <>
                  <Camera className="mr-2 inline h-5 w-5" aria-hidden />
                  Start camera
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (isKiosk) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {!autoStart ? (
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              disabled={disabled}
              onClick={running ? stopCamera : startCamera}
              className={cn(
                "min-h-12 rounded-xl px-5 text-base font-semibold",
                running ? "bg-slate-200 text-slate-900" : "bg-[#0040e0] text-white hover:bg-[#0035be]"
              )}
            >
              {running ? (
                <>
                  <CameraOff className="mr-2 inline h-5 w-5" aria-hidden />
                  Stop camera
                </>
              ) : (
                <>
                  <Camera className="mr-2 inline h-5 w-5" aria-hidden />
                  Start camera
                </>
              )}
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mb-2 text-sm text-amber-800" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className={cn(
            "relative min-h-[10rem] flex-1 overflow-hidden rounded-xl bg-black/90",
            running ? "aspect-[4/3] max-h-[14rem]" : "flex aspect-[4/3] max-h-[14rem] items-center justify-center"
          )}
        >
          <video ref={videoRef} className={cn("h-full w-full object-cover", !running && "hidden")} playsInline muted />
          {!running ? (
            <span className="px-4 text-center text-sm text-slate-400">
              {autoStart ? "Starting camera…" : "Tap start camera"}
            </span>
          ) : (
            <div
              className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/50"
              aria-hidden
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Scan attendee QR</h3>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-3 py-1.5 text-xs"
          disabled={disabled}
          onClick={running ? stopCamera : startCamera}
        >
          {running ? (
            <>
              <CameraOff className="mr-2 inline h-4 w-4" aria-hidden />
              Stop camera
            </>
          ) : (
            <>
              <Camera className="mr-2 inline h-4 w-4" aria-hidden />
              Start camera
            </>
          )}
        </Button>
      </div>
      <p className="mt-1 text-sm text-slate-600">Use the QR from the registration confirmation email.</p>

      {error ? (
        <p className="mt-3 text-sm text-amber-800" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className={cn(
          "relative mt-4 overflow-hidden rounded-md bg-black/90",
          running ? "aspect-video max-h-[260px]" : "flex aspect-video max-h-[260px] items-center justify-center"
        )}
      >
        <video ref={videoRef} className={cn("h-full w-full object-cover", !running && "hidden")} playsInline muted />
        {!running ? (
          <span className="text-sm text-slate-400">Camera preview</span>
        ) : null}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
