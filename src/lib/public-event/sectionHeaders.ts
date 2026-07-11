import type { PublicEventExperiencePayload } from "./experience";

/** Sections that support optional badge / title / description overrides (spotlight uses `spotlight.*`). */
export type PublicEventSectionHeaderKey =
  | "overview"
  | "venueOps"
  | "program"
  | "speakers"
  | "partners"
  | "news"
  | "gallery"
  | "pricing"
  | "resources"
  | "contact"
  | "faq";

export type PublicEventSectionHeaderCopy = {
  badge: string | null;
  title: string | null;
  description: string | null;
};

export type PublicEventSectionHeaders = Partial<
  Record<PublicEventSectionHeaderKey, PublicEventSectionHeaderCopy>
>;

type ResolvedSectionHeader = {
  badge?: string;
  /** `null` when the organizer cleared the optional section title in CMS. */
  title: string | null;
  description?: string;
};

type SectionHeaderDefaults = ResolvedSectionHeader & {
  night?: Partial<ResolvedSectionHeader>;
};

const DEFAULTS: Record<PublicEventSectionHeaderKey, SectionHeaderDefaults> = {
  overview: {
    title: "About this program"
  },
  venueOps: {
    title: "Venue & operations",
    description: "Practical information for arrival, access, and connectivity at the venue."
  },
  program: {
    title: "Summit Agenda",
    description:
      "Explore the foundational dialogues, policy masterclasses, and exclusive networking sessions shaping the future of international trade law and digital economy innovation.",
    night: {
      title: "Summit Agenda"
    }
  },
  speakers: {
    badge: "Faculty",
    title: "Program faculty",
    description:
      "Featured speakers and dignitaries — photos, titles, and profiles from your event CMS.",
    night: { badge: "Faculty", title: "Program faculty" }
  },
  partners: {
    title: "Partners"
  },
  news: {
    badge: "Updates",
    title: "News & media",
    description: "Stay updated with announcements, press releases, and featured stories."
  },
  gallery: {
    badge: "Gallery",
    title: "Event gallery",
    description: "Moments from past editions and the host destination."
  },
  pricing: {
    badge: "Registration",
    title: "Choose your access level",
    description: "Select the pass that fits your role. All tiers include core summit programming."
  },
  resources: {
    title: "Summit resources",
    description: "Downloadable materials and the generated agenda PDF."
  },
  contact: {
    title: "Get in touch",
    description: "Reach the organizing team for registration or logistics questions."
  },
  faq: {
    badge: "Help",
    title: "Frequently asked questions",
    description: "Quick answers about registration, travel, and on-site logistics.",
    night: { badge: "Help", title: "FAQ" }
  }
};

export function resolvePublicEventSectionHeader(
  key: PublicEventSectionHeaderKey,
  experience: PublicEventExperiencePayload,
  opts?: { variant?: "summit" | "night-edition" | "technexus" }
): ResolvedSectionHeader {
  const cms = experience.sectionHeaders?.[key];

  /** Template 3 — only CMS section heading fields; no built-in placeholder copy. */
  if (opts?.variant === "technexus") {
    return {
      title: cms?.title ?? null,
      ...(cms?.badge?.trim() ? { badge: cms.badge.trim() } : {}),
      ...(cms?.description?.trim() ? { description: cms.description.trim() } : {})
    };
  }

  const base = DEFAULTS[key];
  const variantDefaults = opts?.variant === "night-edition" ? base.night : undefined;
  const hasCmsHeaderBlock = cms != null;

  const title: string | null = hasCmsHeaderBlock
    ? (cms.title ?? null)
    : variantDefaults?.title || base.title;

  const badgeRaw = hasCmsHeaderBlock
    ? cms.badge?.trim() || undefined
    : variantDefaults?.badge || base.badge;

  const descriptionRaw = hasCmsHeaderBlock
    ? cms.description?.trim() || undefined
    : variantDefaults?.description || base.description;

  return {
    title,
    ...(badgeRaw ? { badge: badgeRaw } : {}),
    ...(descriptionRaw ? { description: descriptionRaw } : {})
  };
}
