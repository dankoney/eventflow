import { EventBlueprintTemplate } from "@prisma/client";

import type { RegistrationProfile } from "@/lib/event-wizard/registrationProfile";
import { registrationProfileForTemplate } from "@/lib/event-wizard/registrationProfile";

export type BlueprintMeta = {
  id: EventBlueprintTemplate;
  title: string;
  subtitle: string;
  /** Lucide-style hint for card art */
  accent: "slate" | "indigo" | "amber" | "emerald";
};

export const LAUNCHPAD_BLUEPRINTS: BlueprintMeta[] = [
  {
    id: EventBlueprintTemplate.BLANK,
    title: "Blank program",
    subtitle: "Start from scratch with full control over every step.",
    accent: "slate"
  },
  {
    id: EventBlueprintTemplate.CONFERENCE,
    title: "Conference",
    subtitle: "Public audience, travel-ready, and sponsor-grade registration fields.",
    accent: "indigo"
  },
  {
    id: EventBlueprintTemplate.INTERNAL_STAFF,
    title: "Internal staff programme",
    subtitle: "Trainings, briefings, and staff meetings — roster, memo notices, and check-in (no RSVP).",
    accent: "amber"
  },
  {
    id: EventBlueprintTemplate.TRAINING_WORKSHOP,
    title: "Training / workshop",
    subtitle: "Stakeholder sessions with a materials hub for links and PDFs.",
    accent: "emerald"
  }
];

export function blueprintDefaults(template: EventBlueprintTemplate): {
  allowPublicRegistration: boolean;
  /** Command Center (`/o/[orgSlug]`) walk-ins when email is not on guest list or CRM. */
  allowFlashEntry: boolean;
  registrationProfile: RegistrationProfile;
} {
  switch (template) {
    case EventBlueprintTemplate.CONFERENCE:
      return {
        allowPublicRegistration: true,
        allowFlashEntry: true,
        registrationProfile: registrationProfileForTemplate(template)
      };
    case EventBlueprintTemplate.INTERNAL_STAFF:
      return {
        allowPublicRegistration: false,
        allowFlashEntry: true,
        registrationProfile: registrationProfileForTemplate(template)
      };
    case EventBlueprintTemplate.TRAINING_WORKSHOP:
      return {
        allowPublicRegistration: true,
        allowFlashEntry: true,
        registrationProfile: registrationProfileForTemplate(template)
      };
    default:
      return {
        allowPublicRegistration: true,
        allowFlashEntry: true,
        registrationProfile: registrationProfileForTemplate(EventBlueprintTemplate.BLANK)
      };
  }
}
