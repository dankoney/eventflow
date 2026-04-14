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
};

export function QRScanner({ onDecode, cooldownMs = 2500 }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEmitRef = useRef<{ payload: string; at: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (code?.data) {
      const raw = code.data.trim();
      if (validateGuestQrCode(raw)) {
        const now = Date.now();
        const last = lastEmitRef.current;
        if (!last || last.payload !== raw || now - last.at > cooldownMs) {
          lastEmitRef.current = { payload: raw, at: now };
          onDecode(raw);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [cooldownMs, onDecode]);

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
      setError("Camera permission denied or unavailable. Use manual search below.");
      setRunning(false);
    }
  }, [tick]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Scan QR</h3>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-3 py-1.5 text-xs"
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
      <p className="mt-1 text-sm text-slate-600">Point at the registration QR from the guest email.</p>

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
