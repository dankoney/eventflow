import { createHash } from "crypto";

import { PUBLIC_EVENT_DEFAULT_LOCALE, type PublicEventLocale } from "./locales";

type CacheEntry = { translations: string[]; at: number };

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const cache = new Map<string, CacheEntry>();

function cacheKey(texts: string[], target: PublicEventLocale, source: PublicEventLocale): string {
  const hash = createHash("sha256").update(texts.join("\x1e")).digest("hex");
  return `${source}:${target}:${hash}`;
}

function getTranslateApiKey(): string | null {
  return (
    process.env.GOOGLE_TRANSLATE_API_KEY?.trim() ||
    process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY?.trim() ||
    null
  );
}

async function translateWithGoogle(
  texts: string[],
  target: PublicEventLocale,
  source: PublicEventLocale
): Promise<string[] | null> {
  const apiKey = getTranslateApiKey();
  if (!apiKey || texts.length === 0) return null;

  const url = new URL("https://translation.googleapis.com/language/translate/v2");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("target", target);
  if (source !== PUBLIC_EVENT_DEFAULT_LOCALE) {
    url.searchParams.set("source", source);
  }
  for (const text of texts) {
    url.searchParams.append("q", text);
  }

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    data?: { translations?: Array<{ translatedText?: string }> };
  };
  const rows = json.data?.translations;
  if (!rows || rows.length !== texts.length) return null;
  return rows.map((row, i) => row.translatedText ?? texts[i]);
}

async function translateWithLibre(
  texts: string[],
  target: PublicEventLocale,
  source: PublicEventLocale
): Promise<string[] | null> {
  if (texts.length === 0) return [];

  const endpoint = process.env.LIBRETRANSLATE_URL?.trim() || "https://libretranslate.com/translate";
  const apiKey = process.env.LIBRETRANSLATE_API_KEY?.trim();

  const out: string[] = [];
  for (const text of texts) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: "text",
        ...(apiKey ? { api_key: apiKey } : {})
      })
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { translatedText?: string };
    out.push(json.translatedText ?? text);
  }
  return out;
}

/** Batch-translate strings; returns originals when no provider is configured. */
export async function translateTextBatch(
  texts: string[],
  target: PublicEventLocale,
  source: PublicEventLocale = PUBLIC_EVENT_DEFAULT_LOCALE
): Promise<string[]> {
  if (target === source || texts.length === 0) return texts;

  const key = cacheKey(texts, target, source);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.translations;

  let translated =
    (await translateWithGoogle(texts, target, source)) ??
    (await translateWithLibre(texts, target, source));

  if (!translated) translated = texts;

  cache.set(key, { translations: translated, at: Date.now() });
  return translated;
}

export async function translateEntries(
  entries: Array<{ id: string; text: string }>,
  target: PublicEventLocale,
  source: PublicEventLocale = PUBLIC_EVENT_DEFAULT_LOCALE
): Promise<Record<string, string>> {
  if (target === source || entries.length === 0) return {};

  const texts = entries.map((e) => e.text);
  const translated = await translateTextBatch(texts, target, source);
  const map: Record<string, string> = {};
  entries.forEach((entry, i) => {
    map[entry.id] = translated[i] ?? entry.text;
  });
  return map;
}
