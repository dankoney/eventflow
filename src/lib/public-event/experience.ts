import { z } from "zod";

import { PUBLIC_EVENT_HERO_STYLES } from "./heroStyles";
import {
  SPEAKER_HOVER_STYLES,
  SPEAKER_LAYOUT_MODES
} from "./speakersDisplay";

const optionalUrl = z
  .string()
  .max(2048)
  .transform((v) => v.trim())
  .transform((v) => (v.startsWith("uploads/") ? `/${v}` : v))
  .transform((v) => (v.length ? v : null))
  .nullable()
  .refine(
    (v) => v === null || /^https?:\/\//i.test(v) || v.startsWith("/uploads/"),
    "Use a valid URL or uploaded file path"
  );

export const publicEventAgendaTagToneSchema = z.enum([
  "primary",
  "secondary",
  "tertiary",
  "neutral"
]);

export const publicEventAgendaTagSchema = z.object({
  label: z.string().trim().min(1).max(40),
  tone: publicEventAgendaTagToneSchema.default("neutral")
});

export const publicEventAgendaRowKindSchema = z.enum(["session", "break"]);

export const publicEventAgendaItemSchema = z.object({
  id: z.string().min(1),
  time: z.string().trim().min(1).max(24),
  title: z.string().trim().min(1).max(160),
  detail: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  /** Session card vs compact break row (lunch, dinner, networking). */
  rowKind: publicEventAgendaRowKindSchema.default("session"),
  /** Optional room or stage label shown on the public agenda card. */
  venueLabel: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  /** Explicit session tags — when empty, the public page may infer tags from title/detail. */
  tags: z.array(publicEventAgendaTagSchema).max(6).default([]),
  /** Speaker ids from `experience.speakers` — renders avatar stack on session rows. */
  speakerIds: z.array(z.string().min(1)).max(6).default([])
});

export type PublicEventAgendaItem = z.infer<typeof publicEventAgendaItemSchema>;
export type PublicEventAgendaTag = z.infer<typeof publicEventAgendaTagSchema>;
export type PublicEventAgendaTagTone = z.infer<typeof publicEventAgendaTagToneSchema>;

export const publicEventSectionHeaderSchema = z
  .object({
    badge: z
      .string()
      .max(80)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    title: z
      .string()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    description: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null))
  })
  .default({});

export const publicEventSectionHeadersSchema = z
  .object({
    overview: publicEventSectionHeaderSchema.optional(),
    venueOps: publicEventSectionHeaderSchema.optional(),
    program: publicEventSectionHeaderSchema.optional(),
    speakers: publicEventSectionHeaderSchema.optional(),
    partners: publicEventSectionHeaderSchema.optional(),
    news: publicEventSectionHeaderSchema.optional(),
    gallery: publicEventSectionHeaderSchema.optional(),
    pricing: publicEventSectionHeaderSchema.optional(),
    resources: publicEventSectionHeaderSchema.optional(),
    contact: publicEventSectionHeaderSchema.optional(),
    faq: publicEventSectionHeaderSchema.optional()
  })
  .default({});

export const publicEventFaqItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().trim().min(1).max(300),
  answer: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .transform((v) => v.trim())
});

export type PublicEventFaqItem = z.infer<typeof publicEventFaqItemSchema>;

export function createDefaultAgendaItem(id: string): PublicEventAgendaItem {
  return {
    id,
    time: "09:00",
    title: "",
    detail: null,
    rowKind: "session",
    venueLabel: null,
    tags: [],
    speakerIds: []
  };
}

export const publicEventSpeakerSocialSchema = z
  .object({
    linkedin: optionalUrl.optional(),
    twitter: optionalUrl.optional(),
    website: optionalUrl.optional()
  })
  .default({});

export const publicEventSpeakerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  company: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : "")),
  bio: z
    .string()
    .trim()
    .max(1200)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : "")),
  imageUrl: optionalUrl.optional(),
  /** Optional social profile URLs — rendered in speaker cards when present. */
  social: publicEventSpeakerSocialSchema.optional()
});

function isNonEmptyRecord(row: unknown): row is Record<string, unknown> {
  return row != null && typeof row === "object";
}

/** Drop placeholder speaker rows that have not been started yet. */
function preprocessSpeakers(val: unknown): unknown {
  if (!Array.isArray(val)) return val;
  return val.filter((row) => {
    if (!isNonEmptyRecord(row)) return false;
    const name = String(row.name ?? "").trim();
    const title = String(row.title ?? "").trim();
    return name.length > 0 && title.length > 0;
  });
}

/** Drop resource rows with no title (editor placeholders). */
function preprocessResources(val: unknown): unknown {
  if (!Array.isArray(val)) return val;
  return val.filter((row) => {
    if (!isNonEmptyRecord(row)) return false;
    return String(row.title ?? "").trim().length > 0;
  });
}

export const publicEventResourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    kind: z
      .string()
      .trim()
      .max(32)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : "PDF")),
    meta: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    summary: z
      .string()
      .trim()
      .max(300)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    url: optionalUrl.optional(),
    fileUrl: optionalUrl.optional()
  })
  .superRefine((row, ctx) => {
    if (!row.url && !row.fileUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Resource needs a link or uploaded file",
        path: ["url"]
      });
    }
  });

/** Organizer contact shown on the public event site and to attendees. */
export const publicEventContactSchema = z
  .object({
    heading: z
      .string()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v == null || !String(v).trim() ? null : String(v).trim())),
    contactName: z
      .string()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v == null || !String(v).trim() ? null : String(v).trim())),
    email: z
      .string()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => (v == null || !String(v).trim() ? null : String(v).trim()))
      .refine((v) => v === null || z.string().email().safeParse(v).success, {
        message: "Enter a valid email address"
      }),
    phone: z
      .string()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => (v == null || !String(v).trim() ? null : String(v).trim())),
    website: optionalUrl.optional(),
    imageUrl: optionalUrl.optional(),
    note: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => (v == null || !String(v).trim() ? null : String(v).trim()))
  })
  .default({});

/**
 * Per-section visibility flags. Lets organisers hide specific sections of the
 * public event page (e.g. "I don't want the Overview block but keep everything
 * else") without having to clear the underlying fields. Each flag defaults to
 * `true` so existing events keep showing everything that's configured.
 *
 * `election` only takes effect when an event has a poll configured — if no
 * poll exists, the section is already absent.
 */
const spotlightStatSchema = z.object({
  value: z.string().trim().min(1).max(32),
  label: z.string().trim().min(1).max(80)
});

const spotlightCarouselItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  imageUrl: optionalUrl.optional(),
  href: optionalUrl.optional()
});

/** Host nation / city spotlight — background media, stats, optional carousel. */
export const publicEventSpotlightSchema = z
  .object({
    badge: z
      .string()
      .max(80)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    title: z
      .string()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    description: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    backgroundImageUrl: optionalUrl.optional(),
    backgroundVideoUrl: optionalUrl.optional(),
    /** Autoplay spotlight video muted in a loop (YouTube or direct file). */
    backgroundVideoAutoplay: z.boolean().default(true),
    locationLabel: z
      .string()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    stats: z.array(spotlightStatSchema).max(6).default([]),
    carouselItems: z.array(spotlightCarouselItemSchema).max(12).default([]),
    ctaLabel: z
      .string()
      .max(80)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    ctaHref: optionalUrl.optional()
  })
  .default({});

export const publicEventPartnerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  logoUrl: optionalUrl.optional(),
  href: optionalUrl.optional()
});

export const publicEventNewsItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  /** ISO date (YYYY-MM-DD) for the editor date picker; optional for legacy rows. */
  dateIso: z
    .string()
    .max(10)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  dateLabel: z.string().trim().min(1).max(40),
  excerpt: z
    .string()
    .trim()
    .max(400)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  imageUrl: optionalUrl.optional(),
  href: optionalUrl.optional(),
  /** article | press | video */
  mediaType: z.enum(["article", "press", "video"]).default("article"),
  videoEmbedUrl: optionalUrl.optional()
});

export const publicEventGalleryItemSchema = z.object({
  id: z.string().min(1),
  imageUrl: optionalUrl.optional(),
  caption: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null))
});

export const publicEventPricingTierSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  priceLabel: z.string().trim().min(1).max(40),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  features: z
    .array(z.string().max(120))
    .max(12)
    .default([])
    .transform((arr) => arr.map((s) => s.trim()).filter(Boolean)),
  highlighted: z.boolean().default(false),
  ctaLabel: z.string().trim().min(1).max(40).default("Register"),
  ctaHref: optionalUrl.optional()
});

export const publicEventSectionVisibilitySchema = z
  .object({
    overview: z.boolean().default(true),
    spotlight: z.boolean().default(true),
    countdown: z.boolean().default(true),
    program: z.boolean().default(true),
    venueOps: z.boolean().default(true),
    speakers: z.boolean().default(true),
    partners: z.boolean().default(true),
    news: z.boolean().default(true),
    gallery: z.boolean().default(true),
    resources: z.boolean().default(true),
    pricing: z.boolean().default(true),
    election: z.boolean().default(true),
    faq: z.boolean().default(true),
    contact: z.boolean().default(true)
  })
  .default({
    overview: true,
    spotlight: true,
    countdown: true,
    program: true,
    venueOps: true,
    speakers: true,
    partners: true,
    news: true,
    gallery: true,
    resources: true,
    pricing: true,
    election: true,
    faq: true,
    contact: true
  });

export type PublicEventSectionKey = keyof z.infer<typeof publicEventSectionVisibilitySchema>;

const overviewCarouselItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  imageUrl: optionalUrl.optional(),
  href: optionalUrl.optional()
});

const overviewCountryFlagSchema = z.object({
  id: z.string().min(1),
  countryName: z.string().trim().min(1).max(80),
  flagImageUrl: optionalUrl.optional()
});

const optionalHexColor = z
  .string()
  .max(7)
  .optional()
  .nullable()
  .transform((v) => {
    if (!v?.trim()) return null;
    const t = v.trim();
    return /^#[0-9A-Fa-f]{6}$/.test(t) ? t : null;
  });

export const publicEventOverviewHighlightsSchema = z
  .object({
    /** default = built-in icon bullets; carousel / country_flags replace them; none hides the block */
    mode: z.enum(["default", "carousel", "country_flags", "none"]).default("default"),
    carouselItems: z.array(overviewCarouselItemSchema).max(12).default([]),
    countryFlags: z.array(overviewCountryFlagSchema).max(48).default([]),
    /** ISO 3166-1 alpha-2 codes selected via continent picker */
    selectedCountryCodes: z.array(z.string().length(2)).max(200).default([])
  })
  .default({ mode: "default", carouselItems: [], countryFlags: [], selectedCountryCodes: [] });

export const publicEventHeroSchema = z
  .object({
    style: z.enum(PUBLIC_EVENT_HERO_STYLES).optional().nullable(),
    videoUrl: optionalUrl.optional(),
    splitImageUrl: optionalUrl.optional(),
    splitMediaType: z.enum(["image", "video"]).default("image"),
    videoPlayback: z.enum(["autoplay", "click"]).default("click"),
    showSubtitle: z.boolean().default(false),
    subtitle: z
      .string()
      .max(600)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    titleFontSize: z.enum(["auto", "sm", "md", "lg", "xl"]).optional().nullable(),
    titleFontFamily: z.enum(["auto", "display", "body", "headline", "mono"]).optional().nullable(),
    titleColor: optionalHexColor,
    titleGradientFrom: optionalHexColor,
    titleGradientTo: optionalHexColor,
    titleAccentColor: optionalHexColor,
    titleUseAccentWord: z.boolean().default(true),
    backgroundColor: optionalHexColor,
    backgroundGradientFrom: optionalHexColor,
    backgroundGradientTo: optionalHexColor,
    overlayColor: optionalHexColor,
    overlayGradientFrom: optionalHexColor,
    overlayGradientTo: optionalHexColor,
    showOrgBadge: z.boolean().default(true),
    showConferenceTagline: z.boolean().default(true),
    conferenceTagline: z
      .string()
      .max(600)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    subtitleColor: optionalHexColor
  })
  .default({});

export const publicEventThemeCustomizationSchema = z
  .object({
    sectionBandPattern: z.enum(["zebra", "all_base", "all_alt", "minimal"]).default("zebra"),
    sectionContrast: z.enum(["subtle", "medium", "bold"]).default("subtle"),
    footerVariant: z.enum(["default", "minimal", "centered", "brand_bar"]).default("default"),
    footerCustomText: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.trim() : null)),
    footerShowPoweredBy: z.boolean().default(true)
  })
  .default({});

export const publicEventSpeakersDisplaySchema = z
  .object({
    layout: z.enum(SPEAKER_LAYOUT_MODES).default("grid"),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
    hoverStyle: z.enum(SPEAKER_HOVER_STYLES).default("zoom"),
    nameColor: optionalHexColor,
    titleColor: optionalHexColor,
    companyColor: optionalHexColor,
    bioColor: optionalHexColor,
    socialColor: optionalHexColor
  })
  .default({ layout: "grid", columns: 3, hoverStyle: "zoom" });

export const publicEventExperienceSchema = z.object({
  programMode: z.enum(["SAME_FOR_ALL_DAYS", "PER_DAY"]).default("SAME_FOR_ALL_DAYS"),
  sectionVisibility: publicEventSectionVisibilitySchema,
  sectionHeaders: publicEventSectionHeadersSchema,
  agenda: z.array(publicEventAgendaItemSchema).max(40).default([]),
  agendaByDay: z
    .array(
      z.object({
        dayIndex: z.number().int().min(1).max(31),
        items: z.array(publicEventAgendaItemSchema).max(40).default([])
      })
    )
    .max(31)
    .default([]),
  venue: z
    .object({
      wifiSsid: z.string().trim().max(120).optional().nullable(),
      wifiPassword: z.string().trim().max(120).optional().nullable(),
      wifiNote: z.string().trim().max(500).optional().nullable(),
      parkingInfo: z.string().trim().max(1000).optional().nullable(),
      accessInfo: z.string().trim().max(1000).optional().nullable()
    })
    .default({}),
  speakers: z.preprocess(preprocessSpeakers, z.array(publicEventSpeakerSchema).max(20).default([])),
  resources: z.preprocess(preprocessResources, z.array(publicEventResourceSchema).max(40).default([])),
  spotlight: publicEventSpotlightSchema,
  partners: z.array(publicEventPartnerSchema).max(24).default([]),
  newsItems: z.array(publicEventNewsItemSchema).max(24).default([]),
  galleryItems: z.array(publicEventGalleryItemSchema).max(48).default([]),
  pricingTiers: z.array(publicEventPricingTierSchema).max(8).default([]),
  faqItems: z.array(publicEventFaqItemSchema).max(24).default([]),
  faqImageUrl: optionalUrl.optional().nullable(),
  /** Optional hero-style image in the overview sidebar (Template 1). */
  overviewImageUrl: optionalUrl.optional().nullable(),
  overviewHighlights: publicEventOverviewHighlightsSchema,
  hero: publicEventHeroSchema,
  speakersDisplay: publicEventSpeakersDisplaySchema,
  themeCustomization: publicEventThemeCustomizationSchema,
  contact: publicEventContactSchema
});

export type PublicEventExperiencePayload = z.infer<typeof publicEventExperienceSchema>;

function normalizeAgendaItem(item: unknown): unknown {
  if (item == null || typeof item !== "object") return item;
  const row = item as Record<string, unknown>;
  return {
    ...row,
    rowKind: row.rowKind === "break" ? "break" : "session",
    venueLabel: row.venueLabel ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    speakerIds: Array.isArray(row.speakerIds) ? row.speakerIds : []
  };
}

function normalizeAgendaList(list: unknown): unknown {
  if (!Array.isArray(list)) return list;
  return list.map(normalizeAgendaItem);
}

/** Ensures legacy JSON gains new section keys and agenda fields after schema expansion. */
function mergeLegacyExperience(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const base = raw as Record<string, unknown>;
  const vis = base.sectionVisibility;
  const withVisibility =
    vis != null && typeof vis === "object"
      ? {
          ...base,
          sectionVisibility: {
            overview: true,
            spotlight: true,
            countdown: true,
            program: true,
            venueOps: true,
            speakers: true,
            partners: true,
            news: true,
            gallery: true,
            resources: true,
            pricing: true,
            election: true,
            faq: true,
            contact: true,
            ...(vis as Record<string, boolean>)
          }
        }
      : base;

  const agenda = normalizeAgendaList(withVisibility.agenda);
  const agendaByDay = Array.isArray(withVisibility.agendaByDay)
    ? (withVisibility.agendaByDay as Array<Record<string, unknown>>).map((day) => ({
        ...day,
        items: normalizeAgendaList(day.items)
      }))
    : withVisibility.agendaByDay;

  return {
    ...withVisibility,
    sectionHeaders:
      withVisibility.sectionHeaders != null && typeof withVisibility.sectionHeaders === "object"
        ? withVisibility.sectionHeaders
        : {},
    hero:
      withVisibility.hero != null && typeof withVisibility.hero === "object" ? withVisibility.hero : {},
    overviewHighlights:
      withVisibility.overviewHighlights != null && typeof withVisibility.overviewHighlights === "object"
        ? withVisibility.overviewHighlights
        : { mode: "default", carouselItems: [], countryFlags: [], selectedCountryCodes: [] },
    speakersDisplay:
      withVisibility.speakersDisplay != null && typeof withVisibility.speakersDisplay === "object"
        ? withVisibility.speakersDisplay
        : undefined,
    themeCustomization:
      withVisibility.themeCustomization != null && typeof withVisibility.themeCustomization === "object"
        ? withVisibility.themeCustomization
        : {},
    agenda,
    agendaByDay
  };
}

export function parsePublicEventExperience(raw: unknown): PublicEventExperiencePayload {
  const merged = mergeLegacyExperience(raw);
  const parsed = publicEventExperienceSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  return publicEventExperienceSchema.parse({});
}

