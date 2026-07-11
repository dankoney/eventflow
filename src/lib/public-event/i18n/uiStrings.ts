import type { PublicEventLocale } from "./locales";
import { PUBLIC_EVENT_DEFAULT_LOCALE } from "./locales";

export type UiStringKey =
  | "nav.program"
  | "nav.about"
  | "nav.gallery"
  | "nav.venue"
  | "nav.speakers"
  | "nav.news"
  | "nav.resources"
  | "nav.pricing"
  | "nav.election"
  | "nav.faq"
  | "nav.contact"
  | "action.register"
  | "action.registerNow"
  | "action.getDirections"
  | "action.ended"
  | "action.closed"
  | "action.checkIn"
  | "overview.aboutTitle"
  | "overview.organizerPlaceholder"
  | "overview.venue"
  | "overview.countriesAttending"
  | "overview.programHighlights"
  | "section.overview.title"
  | "section.overview.description"
  | "section.venueOps.title"
  | "section.venueOps.description"
  | "section.program.title"
  | "section.program.description"
  | "section.speakers.badge"
  | "section.speakers.title"
  | "section.speakers.description"
  | "section.partners.title"
  | "section.news.badge"
  | "section.news.title"
  | "section.news.description"
  | "section.gallery.badge"
  | "section.gallery.title"
  | "section.gallery.description"
  | "section.pricing.badge"
  | "section.pricing.title"
  | "section.pricing.description"
  | "section.resources.title"
  | "section.resources.description"
  | "section.contact.title"
  | "section.contact.description"
  | "section.faq.badge"
  | "section.faq.title"
  | "section.faq.description"
  | "language.label"
  | "language.translating"
  | "language.select";

const EN: Record<UiStringKey, string> = {
  "nav.program": "Program",
  "nav.about": "About",
  "nav.gallery": "Gallery",
  "nav.venue": "Venue",
  "nav.speakers": "Speakers",
  "nav.news": "News",
  "nav.resources": "Resources",
  "nav.pricing": "Pricing",
  "nav.election": "Election",
  "nav.faq": "FAQ",
  "nav.contact": "Contact",
  "action.register": "Register",
  "action.registerNow": "Register now",
  "action.getDirections": "Get directions",
  "action.ended": "Ended",
  "action.closed": "Closed",
  "action.checkIn": "Check-in",
  "overview.aboutTitle": "About this program",
  "overview.organizerPlaceholder": "Your organizer can add a full description in Eventflow.",
  "overview.venue": "Venue",
  "overview.countriesAttending": "Countries attending",
  "overview.programHighlights": "Program highlights",
  "section.overview.title": "About this program",
  "section.overview.description":
    "What attendees can expect from the format, audience, and outcomes. The main description is set on the event record in Eventflow.",
  "section.venueOps.title": "Venue & operations",
  "section.venueOps.description":
    "Practical information for arrival, access, and connectivity at the venue.",
  "section.program.title": "Summit Agenda",
  "section.program.description":
    "Explore the foundational dialogues, policy masterclasses, and exclusive networking sessions shaping the future of international trade law and digital economy innovation.",
  "section.speakers.badge": "Faculty",
  "section.speakers.title": "Program faculty",
  "section.speakers.description":
    "Featured speakers and dignitaries — photos, titles, and profiles from your event CMS.",
  "section.partners.title": "Partners",
  "section.news.badge": "Updates",
  "section.news.title": "News & media",
  "section.news.description": "Stay updated with announcements, press releases, and featured stories.",
  "section.gallery.badge": "Gallery",
  "section.gallery.title": "Event gallery",
  "section.gallery.description": "Moments from past editions and the host destination.",
  "section.pricing.badge": "Registration",
  "section.pricing.title": "Choose your access level",
  "section.pricing.description":
    "Select the pass that fits your role. All tiers include core summit programming.",
  "section.resources.title": "Summit resources",
  "section.resources.description": "Downloadable materials and the generated agenda PDF.",
  "section.contact.title": "Get in touch",
  "section.contact.description":
    "Reach the organizing team for registration or logistics questions.",
  "section.faq.badge": "Help",
  "section.faq.title": "Frequently asked questions",
  "section.faq.description": "Quick answers about registration, travel, and on-site logistics.",
  "language.label": "Language",
  "language.translating": "Translating…",
  "language.select": "Select language"
};

/** Partial locale packs — missing keys fall back to English. */
const PACKS: Partial<Record<PublicEventLocale, Partial<Record<UiStringKey, string>>>> = {
  fr: {
    "nav.program": "Programme",
    "nav.venue": "Lieu",
    "nav.speakers": "Intervenants",
    "nav.news": "Actualités",
    "nav.resources": "Ressources",
    "nav.pricing": "Tarifs",
    "nav.election": "Élection",
    "nav.faq": "FAQ",
    "nav.contact": "Contact",
    "action.register": "S'inscrire",
    "action.registerNow": "S'inscrire maintenant",
    "action.getDirections": "Obtenir l'itinéraire",
    "action.ended": "Terminé",
    "action.closed": "Fermé",
    "action.checkIn": "Enregistrement",
    "overview.aboutTitle": "À propos de ce programme",
    "overview.organizerPlaceholder":
      "Votre organisateur peut ajouter une description complète dans Eventflow.",
    "overview.venue": "Lieu",
    "overview.countriesAttending": "Pays participants",
    "overview.programHighlights": "Points forts du programme",
    "section.overview.title": "À propos de ce programme",
    "section.program.title": "Programme du sommet",
    "section.speakers.title": "Faculté du programme",
    "section.contact.title": "Nous contacter",
    "language.label": "Langue",
    "language.translating": "Traduction…",
    "language.select": "Choisir la langue"
  },
  de: {
    "nav.program": "Programm",
    "nav.venue": "Veranstaltungsort",
    "nav.speakers": "Referenten",
    "nav.news": "Neuigkeiten",
    "nav.resources": "Ressourcen",
    "nav.pricing": "Preise",
    "nav.contact": "Kontakt",
    "action.register": "Registrieren",
    "action.registerNow": "Jetzt registrieren",
    "action.getDirections": "Route anzeigen",
    "action.ended": "Beendet",
    "action.closed": "Geschlossen",
    "overview.aboutTitle": "Über dieses Programm",
    "overview.venue": "Veranstaltungsort",
    "overview.countriesAttending": "Teilnehmende Länder",
    "language.label": "Sprache",
    "language.translating": "Wird übersetzt…"
  },
  es: {
    "nav.program": "Programa",
    "nav.venue": "Sede",
    "nav.speakers": "Ponentes",
    "nav.news": "Noticias",
    "nav.resources": "Recursos",
    "nav.pricing": "Precios",
    "nav.contact": "Contacto",
    "action.register": "Registrarse",
    "action.registerNow": "Registrarse ahora",
    "action.getDirections": "Cómo llegar",
    "action.ended": "Finalizado",
    "action.closed": "Cerrado",
    "overview.aboutTitle": "Sobre este programa",
    "overview.venue": "Sede",
    "overview.countriesAttending": "Países asistentes",
    "language.label": "Idioma",
    "language.translating": "Traduciendo…"
  },
  pt: {
    "nav.program": "Programa",
    "nav.venue": "Local",
    "nav.speakers": "Palestrantes",
    "nav.contact": "Contato",
    "action.register": "Inscrever-se",
    "action.registerNow": "Inscrever-se agora",
    "action.getDirections": "Como chegar",
    "overview.aboutTitle": "Sobre este programa",
    "overview.venue": "Local",
    "language.label": "Idioma"
  },
  ar: {
    "nav.program": "البرنامج",
    "nav.venue": "المكان",
    "nav.speakers": "المتحدثون",
    "nav.contact": "اتصل بنا",
    "action.register": "التسجيل",
    "action.getDirections": "الاتجاهات",
    "overview.aboutTitle": "حول هذا البرنامج",
    "overview.venue": "المكان",
    "language.label": "اللغة",
    "language.translating": "جارٍ الترجمة…"
  },
  zh: {
    "nav.program": "议程",
    "nav.venue": "场地",
    "nav.speakers": "演讲嘉宾",
    "nav.contact": "联系",
    "action.register": "注册",
    "action.registerNow": "立即注册",
    "action.getDirections": "获取路线",
    "overview.aboutTitle": "关于本项目",
    "overview.venue": "场地",
    "language.label": "语言",
    "language.translating": "翻译中…"
  },
  ja: {
    "nav.program": "プログラム",
    "nav.venue": "会場",
    "nav.speakers": "登壇者",
    "nav.contact": "お問い合わせ",
    "action.register": "登録",
    "action.getDirections": "道順",
    "overview.aboutTitle": "プログラムについて",
    "language.label": "言語"
  },
  ru: {
    "nav.program": "Программа",
    "nav.venue": "Место проведения",
    "nav.speakers": "Спикеры",
    "nav.contact": "Контакты",
    "action.register": "Регистрация",
    "action.getDirections": "Маршрут",
    "overview.aboutTitle": "О программе",
    "language.label": "Язык"
  }
};

export function getUiString(locale: PublicEventLocale, key: UiStringKey): string {
  if (locale === PUBLIC_EVENT_DEFAULT_LOCALE) return EN[key];
  const pack = PACKS[locale];
  return pack?.[key] ?? EN[key];
}
