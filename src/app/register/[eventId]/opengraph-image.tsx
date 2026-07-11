import { readFile } from "fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { getEventForPublicPage } from "@/lib/db/events";
import { absolutePublicAssetUrl } from "@/lib/seo/absolutePublicAssetUrl";
import { heroSolidFillForOg } from "@/lib/ui/heroGradientFromId";

export const alt = "Event program";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

const W = 1200;
const H = 630;
/** Satori/OG: avoid inlining very large data URLs (Passenger OOM or truncated body). */
const MAX_INLINE_BYTES = 350_000;
const TYPE_LABEL: Record<string, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid"
};

function ogSiteBase(): string {
  for (const key of ["NEXTAUTH_URL", "PUBLIC_APP_URL", "APP_URL"] as const) {
    const raw = process.env[key]?.trim().replace(/\/$/, "");
    if (raw) return raw;
  }
  return "";
}

function mimeForPath(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

/**
 * Satori (next/og) has limited CSS: no reliable gradients, hsl(), many rgba() shorthands, etc.
 * Keep layouts minimal so the Node app returns a full PNG (Passenger was streaming HTML errors as image/png before).
 */
export default async function Image({ params }: { params: { eventId: string } }) {
  const event = await getEventForPublicPage(params.eventId);
  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#27272a",
            color: "#fafafa",
            fontSize: 48,
            fontWeight: 700,
            fontFamily: "ui-sans-serif, system-ui, sans-serif"
          }}
        >
          Eventflow
        </div>
      ),
      { width: W, height: H }
    );
  }

  const siteBase = ogSiteBase();
  const rawBanner = event.bannerImageUrl?.trim();

  let bannerSrc: string | null = null;
  if (rawBanner) {
    const b = rawBanner;
    const tryBannerImage = async (): Promise<string | null> => {
      if (/^https:\/\//i.test(b)) {
        return b;
      }
      if (b.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), "public", b.replace(/^\//, ""));
        try {
          const buf = await readFile(filePath);
          if (buf.length <= MAX_INLINE_BYTES) {
            return `data:${mimeForPath(b)};base64,${buf.toString("base64")}`;
          }
        } catch {
          /* use absolute URL if possible */
        }
        if (siteBase) {
          return absolutePublicAssetUrl(siteBase, b) ?? null;
        }
        return null;
      }
      if (siteBase) {
        return absolutePublicAssetUrl(siteBase, b);
      }
      return null;
    };

    bannerSrc = await tryBannerImage();
  }

  const name = event.name || "Event";
  const n = name.length;
  const fontSize = (() => {
    if (n <= 28) return 64;
    if (n <= 52) return 48;
    if (n <= 88) return 38;
    if (n <= 130) return 32;
    return 28;
  })();
  const bg = heroSolidFillForOg(event.id);
  const venue = event.location?.name?.trim() || "Venue TBD";
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(event.date));
  const typeLabel = TYPE_LABEL[event.type] ?? String(event.type || "Event");
  const buttonLabel = "Open Public Page";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: bg,
          fontFamily: "ui-sans-serif, system-ui, sans-serif"
        }}
      >
        <div
          style={{
            height: 255,
            width: "100%",
            display: "flex",
            backgroundColor: "#0a0a0a"
          }}
        >
          {bannerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- OG pipeline
            <img
              src={bannerSrc}
              width={W}
              height={255}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: bg
              }}
            />
          )}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "28px 42px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12
            }}
          >
            <div
              style={{
                color: "#d4d4d8",
                fontSize: 19,
                fontWeight: 600
              }}
            >
              {event.org.name}
            </div>
            <div
              style={{
                color: "#d4d4d8",
                fontSize: 16
              }}
            >
              •
            </div>
            <div
              style={{
                color: "#d4d4d8",
                fontSize: 19,
                fontWeight: 600
              }}
            >
              {typeLabel}
            </div>
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: "100%"
            }}
          >
            {name}
          </div>
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6
              }}
            >
              <div
                style={{
                  color: "#e4e4e7",
                  fontSize: 22,
                  fontWeight: 600
                }}
              >
                {when}
              </div>
              <div
                style={{
                  color: "#d4d4d8",
                  fontSize: 19
                }}
              >
                {venue}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 280,
                padding: "16px 22px",
                borderRadius: 12,
                backgroundColor: "#ffffff",
                color: "#111827",
                fontSize: 24,
                fontWeight: 700
              }}
            >
              {buttonLabel}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
