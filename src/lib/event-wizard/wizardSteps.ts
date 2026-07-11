import { EventBlueprintTemplate } from "@prisma/client";

export type WizardStepId =
  | "event_information"
  | "schedule"
  | "venue"
  | "branding"
  | "accommodation"
  | "staff_policy"
  | "staff_notice"
  | "resources"
  | "promotion"
  | "review";

export const WIZARD_STEP_LABELS: Record<WizardStepId, string> = {
  event_information: "Event information",
  schedule: "Schedule",
  venue: "Venue",
  branding: "Branding",
  accommodation: "Accommodation & travel",
  staff_policy: "Staff access",
  staff_notice: "Notice templates",
  resources: "Session resources",
  promotion: "Promotion & registration",
  review: "Review & launch"
};

export function wizardStepsForTemplate(template: EventBlueprintTemplate): WizardStepId[] {
  const core: WizardStepId[] = ["event_information", "schedule", "venue", "branding"];
  const review: WizardStepId[] = ["review"];

  switch (template) {
    case EventBlueprintTemplate.CONFERENCE:
      return [...core, "accommodation", "promotion", ...review];
    case EventBlueprintTemplate.INTERNAL_STAFF:
      return [...core, "staff_policy", "staff_notice", ...review];
    case EventBlueprintTemplate.TRAINING_WORKSHOP:
      return [...core, "resources", "promotion", ...review];
    default:
      return [...core, "promotion", ...review];
  }
}
