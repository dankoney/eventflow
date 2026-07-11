import { z } from "zod";

import {
  normalizePublicEventLocale,
  PUBLIC_EVENT_DEFAULT_LOCALE,
  type PublicEventLocale
} from "@/lib/public-event/i18n/locales";
import { translateEntries } from "@/lib/public-event/i18n/translateBatch";

const bodySchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        text: z.string().min(1).max(8000)
      })
    )
    .max(200),
  targetLocale: z.string().min(2).max(10),
  sourceLocale: z.string().min(2).max(10).optional()
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid translation request" }, { status: 400 });
  }

  const target = normalizePublicEventLocale(parsed.data.targetLocale);
  const source = normalizePublicEventLocale(parsed.data.sourceLocale ?? PUBLIC_EVENT_DEFAULT_LOCALE);

  if (target === source) {
    const translations: Record<string, string> = {};
    for (const entry of parsed.data.entries) translations[entry.id] = entry.text;
    return Response.json({ success: true, translations, provider: "none" });
  }

  try {
    const translations = await translateEntries(parsed.data.entries, target, source);
    return Response.json({
      success: true,
      translations,
      targetLocale: target as PublicEventLocale,
      provider: process.env.GOOGLE_TRANSLATE_API_KEY ? "google" : "libre"
    });
  } catch {
    const fallback: Record<string, string> = {};
    for (const entry of parsed.data.entries) fallback[entry.id] = entry.text;
    return Response.json({ success: true, translations: fallback, provider: "fallback" });
  }
}
