import type { PublicEventExperiencePayload } from "../experience";
import type { PublicEventSiteSummary } from "@/components/register/public-event/siteSummary";

export type TranslatableEntry = { id: string; text: string };

function add(entries: TranslatableEntry[], id: string, text: string | null | undefined) {
  const value = text?.trim();
  if (!value) return;
  entries.push({ id, text: value });
}

/** Collect CMS strings that should be machine-translated. */
export function extractPublicEventTranslatableStrings(
  summary: PublicEventSiteSummary,
  experience: PublicEventExperiencePayload
): TranslatableEntry[] {
  const out: TranslatableEntry[] = [];

  add(out, "summary.name", summary.name);
  add(out, "summary.description", summary.description);
  add(out, "summary.statusMessage", summary.statusMessage);
  add(out, "summary.registerTabLabel", summary.registerTabLabel);
  add(out, "summary.remainingSeatsSummary", summary.remainingSeatsSummary);
  add(out, "summary.locationLine", summary.locationLine);
  add(out, "summary.location.name", summary.location.name);
  add(out, "summary.location.address", summary.location.address);
  add(out, "summary.location.city", summary.location.city);

  summary.programDays.forEach((day, i) => {
    add(out, `summary.programDays.${i}.label`, day.label);
  });

  const headerKeys = [
    "overview",
    "venueOps",
    "program",
    "speakers",
    "partners",
    "news",
    "gallery",
    "pricing",
    "resources",
    "contact",
    "faq"
  ] as const;

  for (const key of headerKeys) {
    const h = experience.sectionHeaders?.[key];
    if (!h) continue;
    add(out, `sectionHeaders.${key}.badge`, h.badge);
    add(out, `sectionHeaders.${key}.title`, h.title);
    add(out, `sectionHeaders.${key}.description`, h.description);
  }

  add(out, "hero.subtitle", experience.hero?.subtitle);
  add(out, "hero.conferenceTagline", experience.hero?.conferenceTagline);
  add(out, "themeCustomization.footerCustomText", experience.themeCustomization?.footerCustomText);

  const venue = experience.venue;
  if (venue) {
    add(out, "venue.wifiNote", venue.wifiNote);
    add(out, "venue.parkingInfo", venue.parkingInfo);
    add(out, "venue.accessInfo", venue.accessInfo);
  }

  experience.agenda.forEach((item, i) => {
    add(out, `agenda.${i}.title`, item.title);
    add(out, `agenda.${i}.detail`, item.detail);
    add(out, `agenda.${i}.venueLabel`, item.venueLabel);
    item.tags.forEach((tag, ti) => add(out, `agenda.${i}.tags.${ti}.label`, tag.label));
  });

  experience.agendaByDay.forEach((day, di) => {
    day.items.forEach((item, i) => {
      const prefix = `agendaByDay.${di}.items.${i}`;
      add(out, `${prefix}.title`, item.title);
      add(out, `${prefix}.detail`, item.detail);
      add(out, `${prefix}.venueLabel`, item.venueLabel);
      item.tags.forEach((tag, ti) => add(out, `${prefix}.tags.${ti}.label`, tag.label));
    });
  });

  experience.speakers.forEach((s, i) => {
    add(out, `speakers.${i}.name`, s.name);
    add(out, `speakers.${i}.title`, s.title);
    add(out, `speakers.${i}.company`, s.company);
    add(out, `speakers.${i}.bio`, s.bio);
  });

  experience.resources.forEach((r, i) => {
    add(out, `resources.${i}.title`, r.title);
    add(out, `resources.${i}.meta`, r.meta);
    add(out, `resources.${i}.summary`, r.summary);
  });

  const spotlight = experience.spotlight;
  if (spotlight) {
    add(out, "spotlight.badge", spotlight.badge);
    add(out, "spotlight.title", spotlight.title);
    add(out, "spotlight.description", spotlight.description);
    add(out, "spotlight.locationLabel", spotlight.locationLabel);
    add(out, "spotlight.ctaLabel", spotlight.ctaLabel);
    spotlight.stats?.forEach((s, i) => {
      add(out, `spotlight.stats.${i}.value`, s.value);
      add(out, `spotlight.stats.${i}.label`, s.label);
    });
    spotlight.carouselItems?.forEach((c, i) => add(out, `spotlight.carouselItems.${i}.title`, c.title));
  }

  experience.partners.forEach((p, i) => add(out, `partners.${i}.name`, p.name));
  experience.newsItems.forEach((n, i) => {
    add(out, `newsItems.${i}.title`, n.title);
    add(out, `newsItems.${i}.dateLabel`, n.dateLabel);
    add(out, `newsItems.${i}.excerpt`, n.excerpt);
  });
  experience.galleryItems.forEach((g, i) => add(out, `galleryItems.${i}.caption`, g.caption));
  experience.pricingTiers.forEach((t, i) => {
    add(out, `pricingTiers.${i}.name`, t.name);
    add(out, `pricingTiers.${i}.priceLabel`, t.priceLabel);
    add(out, `pricingTiers.${i}.description`, t.description);
    t.features?.forEach((f, fi) => add(out, `pricingTiers.${i}.features.${fi}`, f));
  });
  experience.faqItems.forEach((f, i) => {
    add(out, `faqItems.${i}.question`, f.question);
    add(out, `faqItems.${i}.answer`, f.answer);
  });

  const contact = experience.contact;
  if (contact) {
    add(out, "contact.heading", contact.heading);
    add(out, "contact.contactName", contact.contactName);
    add(out, "contact.note", contact.note);
  }

  experience.overviewHighlights?.carouselItems?.forEach((c, i) => {
    add(out, `overviewHighlights.carouselItems.${i}.title`, c.title);
  });
  experience.overviewHighlights?.countryFlags?.forEach((c, i) => {
    add(out, `overviewHighlights.countryFlags.${i}.countryName`, c.countryName);
  });

  return out;
}

function setAtPath(root: Record<string, unknown>, path: string, value: string) {
  const parts = path.split(".");
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const isIndex = /^\d+$/.test(nextKey);
    if (cur[key] == null) {
      cur[key] = isIndex ? [] : {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Apply translated strings back onto summary + experience copies. */
export function applyPublicEventTranslations(
  summary: PublicEventSiteSummary,
  experience: PublicEventExperiencePayload,
  translations: Record<string, string>
): { summary: PublicEventSiteSummary; experience: PublicEventExperiencePayload } {
  const nextSummary = deepClone(summary) as unknown as Record<string, unknown>;
  const nextExperience = deepClone(experience) as unknown as Record<string, unknown>;

  for (const [id, text] of Object.entries(translations)) {
    if (id.startsWith("summary.")) {
      setAtPath(nextSummary, id.slice("summary.".length), text);
    } else {
      setAtPath(nextExperience, id, text);
    }
  }

  return {
    summary: nextSummary as unknown as PublicEventSiteSummary,
    experience: nextExperience as unknown as PublicEventExperiencePayload
  };
}
