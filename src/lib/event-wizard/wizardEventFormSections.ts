import type { EventFormFieldsSection } from "@/components/events/EventFormFields";
import type { WizardStepId } from "@/lib/event-wizard/wizardSteps";

export function eventFormSectionsForWizardStep(step: WizardStepId): EventFormFieldsSection[] | null {
  switch (step) {
    case "branding":
      return ["identity"];
    case "event_information":
      return ["nameDescription"];
    case "schedule":
      return ["schedule"];
    case "venue":
      return ["venueAttendance"];
    default:
      return null;
  }
}
