"use client";

import QRCode from "qrcode";
import { Check, Copy, ExternalLink, Monitor, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { brandInitials, pickBrandContrastTextColor } from "@/lib/brand/display";
import { embedLogoAsDataUrl, resolveClientBrandLogoUrl } from "@/lib/brand/resolveLogoUrl";
import { renderScreenPosterCanvas } from "@/lib/event-feedback/screenPosterCanvas";

const SCREEN_WIDTH = 1200;
const SCREEN_HEIGHT = 675;

type Props = {
  portalUrl: string | null;
  shortCode: string | null;
  windowPhase: "open" | "not_yet_open" | "closed" | "unavailable";
  windowLabel: string;
  eventName: string;
  orgName: string;
  eventDateLabel: string;
  accentColor?: string;
  /** Server-resolved absolute logo URL (same as feedback emails). */
  logoUrl?: string | null;
  brandLogoUrl?: string | null;
  orgLogoUrl?: string | null;
  orgDefaultBrandLogoUrl?: string | null;
};

/** Embed logo as data URL for html2canvas (display still uses branding URL directly). */
function usePosterLogoDataUrl(logoUrl: string | null) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(!logoUrl);

  useEffect(() => {
    if (!logoUrl) {
      setDataUrl(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void embedLogoAsDataUrl(logoUrl).then((url) => {
      if (cancelled) return;
      setDataUrl(url);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return { dataUrl, ready };
}

export function EventFeedbackShareCard({
  portalUrl,
  shortCode,
  windowPhase,
  windowLabel,
  eventName,
  orgName,
  eventDateLabel,
  accentColor = "#4c1d95",
  logoUrl = null,
  brandLogoUrl = null,
  orgLogoUrl = null,
  orgDefaultBrandLogoUrl = null
}: Props) {
  const effectiveLogoUrl = resolveClientBrandLogoUrl(logoUrl, {
    eventBrandLogoUrl: brandLogoUrl,
    orgLogoUrl,
    orgDefaultBrandLogoUrl
  });
  const { dataUrl: logoDataUrl, ready: logoReady } = usePosterLogoDataUrl(effectiveLogoUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [posterQrDataUrl, setPosterQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!portalUrl) {
      setQrDataUrl(null);
      setPosterQrDataUrl(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      QRCode.toDataURL(portalUrl, { width: 220, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } }),
      QRCode.toDataURL(portalUrl, { width: 480, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
    ])
      .then(([small, large]) => {
        if (!cancelled) {
          setQrDataUrl(small);
          setPosterQrDataUrl(large);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setPosterQrDataUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [portalUrl]);

  async function copyLink() {
    if (!portalUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  function printPoster() {
    window.print();
  }

  async function downloadScreenPoster() {
    if (!posterQrDataUrl || !portalUrl || !shortCode) return;
    setError(null);
    setDownloading(true);
    try {
      let captureLogoSrc = logoDataUrl;
      if (!captureLogoSrc && effectiveLogoUrl) {
        captureLogoSrc = await embedLogoAsDataUrl(effectiveLogoUrl);
      }

      const canvas = await renderScreenPosterCanvas(
        {
          eventName,
          orgName,
          eventDateLabel,
          portalUrl,
          shortCode,
          qrDataUrl: posterQrDataUrl,
          accentColor,
          logoSrc: captureLogoSrc
        },
        2
      );

      const link = document.createElement("a");
      link.download = `feedback-screen-${shortCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      setError("Could not download screen poster.");
    } finally {
      setDownloading(false);
    }
  }

  if (!portalUrl || !shortCode) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
        Public site URL is not configured — set <code className="text-xs">NEXTAUTH_URL</code> to generate a feedback
        QR and short link.
      </section>
    );
  }

  const posterProps = {
    eventName,
    orgName,
    eventDateLabel,
    portalUrl,
    shortCode,
    qrDataUrl: posterQrDataUrl,
    accentColor,
    logoUrl: effectiveLogoUrl
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A3 portrait;
            margin: 12mm;
          }
          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          #feedback-poster-print,
          #feedback-poster-print * {
            visibility: visible !important;
          }
          #feedback-poster-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: 382mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            background: white !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div
        id="feedback-poster-print"
        aria-hidden
        className="pointer-events-none fixed -left-[10000px] top-0 print:static print:left-auto print:top-auto"
      >
        <FeedbackPoster variant="print" {...posterProps} />
      </div>

      <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm print:hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR code for guest feedback"
                className="rounded-xl border border-white bg-white p-2 shadow-sm"
                width={220}
                height={220}
              />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-dashed border-violet-200 bg-white text-xs text-zinc-500">
                Generating QR…
              </div>
            )}
            <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-violet-800/80">
              Scan to give feedback
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-zinc-900">Guest feedback link &amp; QR</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              Share this QR during or after the event. Guests fill the feedback form first, then choose anonymous
              or link to their registration.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Short code: <span className="font-mono font-semibold text-zinc-800">{shortCode}</span> · {windowLabel}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-violet-950">
                {portalUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={printPoster}
                disabled={!posterQrDataUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50 disabled:opacity-60"
              >
                <Printer className="h-4 w-4 shrink-0" aria-hidden />
                Print poster (A3)
              </button>
              <button
                type="button"
                onClick={() => void downloadScreenPoster()}
                disabled={!posterQrDataUrl || downloading || (effectiveLogoUrl ? !logoReady : false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50 disabled:opacity-60"
              >
                <Monitor className="h-4 w-4 shrink-0" aria-hidden />
                {downloading ? "Preparing…" : "Download for screen"}
              </button>
              {windowPhase === "open" ? (
                <Link
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  Open portal
                </Link>
              ) : null}
            </div>
            {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
            {windowPhase === "not_yet_open" ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                The portal link works now, but guests can submit only after the event start time. Print or download
                the poster ahead of time and display it at the venue.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-violet-100 bg-white/80 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-800">Screen poster preview</p>
          <PosterScreenPreview {...posterProps} />
        </div>
      </section>
    </>
  );
}

function PosterScreenPreview(
  props: Parameters<typeof FeedbackPoster>[0] extends infer P ? Omit<P, "variant"> : never
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SCREEN_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="aspect-video w-full max-w-3xl overflow-hidden rounded-xl border border-violet-100 shadow-sm"
    >
      <div
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left"
        }}
      >
        <FeedbackPoster variant="screen" {...props} />
      </div>
    </div>
  );
}

/** Event branding logo for posters — same image as feedback emails. */
function BrandingLogo({
  logoUrl,
  orgName,
  accentColor,
  size,
  forScreen = false
}: {
  logoUrl: string | null;
  orgName: string;
  accentColor: string;
  size: number;
  forScreen?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (logoUrl && !failed) {
    if (forScreen) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-poster-logo="true"
          src={logoUrl}
          alt={orgName}
          onError={() => setFailed(true)}
          className="mx-auto max-h-20 w-auto max-w-[280px] object-contain"
        />
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        data-poster-logo="true"
        src={logoUrl}
        alt={orgName}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="mx-auto max-h-16 w-auto max-w-[200px] rounded-xl object-contain"
      />
    );
  }

  if (logoUrl && failed) {
    return <div className={forScreen ? "h-12 w-32" : "h-12 w-24"} aria-hidden />;
  }

  const contrast = pickBrandContrastTextColor(accentColor);
  return (
    <span
      className="mx-auto inline-flex items-center justify-center rounded-xl font-extrabold"
      style={{
        width: size,
        height: size,
        backgroundColor: accentColor,
        color: contrast,
        fontSize: size * 0.42
      }}
    >
      {brandInitials(orgName)}
    </span>
  );
}

function FeedbackPoster({
  variant,
  eventName,
  orgName,
  eventDateLabel,
  portalUrl,
  shortCode,
  qrDataUrl,
  accentColor,
  logoUrl = null
}: {
  variant: "print" | "screen";
  eventName: string;
  orgName: string;
  eventDateLabel: string;
  portalUrl: string;
  shortCode: string;
  qrDataUrl: string | null;
  accentColor: string;
  logoUrl?: string | null;
}) {
  if (variant === "screen") {
    return (
      <div
        className="relative box-border text-center text-white"
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          background: `linear-gradient(135deg, ${accentColor} 0%, #a855f7 38%, #ec4899 72%, #f97316 100%)`
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 80%, white 0%, transparent 40%)"
          }}
        />
        <div className="relative z-10 flex h-full flex-col items-center justify-between px-12 py-8">
          <div className="flex flex-col items-center">
            <BrandingLogo
              logoUrl={logoUrl}
              orgName={orgName}
              accentColor={accentColor}
              size={48}
              forScreen
            />
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.25em] text-white/90">{orgName}</p>
            <h1 className="mt-2 text-4xl font-bold leading-tight drop-shadow-sm">{eventName}</h1>
            <p className="mt-1 text-lg text-white/90">{eventDateLabel}</p>
          </div>

          <div className="shrink-0 rounded-3xl bg-white p-3 shadow-2xl">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Scan for feedback" width={220} height={220} className="rounded-xl" />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-zinc-500">
                QR loading…
              </div>
            )}
          </div>

          <div className="flex w-full max-w-xl flex-col items-center">
            <p className="text-3xl font-bold drop-shadow-sm">Share your feedback</p>
            <p className="mt-2 max-w-xl text-center text-sm leading-snug text-white/90">
              Scan with your phone camera. Fill the form, then choose anonymous or link to your registration.
            </p>
            <div className="mt-4 w-full rounded-xl bg-white/20 px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Short link</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-white">{portalUrl}</p>
              <p className="mt-1 text-[10px] text-white/70">Code: {shortCode}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[267mm] flex-col items-center justify-center bg-white p-8">
      <div
        className="flex w-full max-w-lg flex-col items-center rounded-3xl border-4 px-10 py-12 text-center shadow-xl"
        style={{ borderColor: accentColor }}
      >
        <BrandingLogo logoUrl={logoUrl} orgName={orgName} accentColor={accentColor} size={48} />
        <p className="mt-4">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white"
            style={{ backgroundColor: accentColor }}
          >
            {orgName}
          </span>
        </p>
        <h1 className="mt-6 text-3xl font-bold leading-tight text-zinc-900">{eventName}</h1>
        <p className="mt-2 text-base text-zinc-600">{eventDateLabel}</p>

        <div className="mt-8">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Scan for feedback"
              width={280}
              height={280}
              className="mx-auto rounded-2xl border-4 border-zinc-100 bg-white p-3"
            />
          ) : (
            <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-sm text-zinc-500">
              QR loading…
            </div>
          )}
        </div>

        <p className="mt-8 text-xl font-bold tracking-tight text-zinc-900">Share your feedback</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Scan with your phone camera. Fill the form, then choose anonymous or link to your registration.
        </p>

        <div className="mt-6 w-full rounded-xl bg-zinc-50 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Short link</p>
          <p className="mt-1 break-all font-mono text-xs font-semibold text-zinc-800">{portalUrl}</p>
          <p className="mt-1 text-[10px] text-zinc-500">Code: {shortCode}</p>
        </div>
      </div>
    </div>
  );
}
