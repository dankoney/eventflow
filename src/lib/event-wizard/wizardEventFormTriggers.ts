import type { FieldPath } from "react-hook-form";

import type { EventFormValues } from "@/components/events/eventFormSchema";
import type { WizardStepId } from "@/lib/event-wizard/wizardSteps";

/** RHF paths to validate when leaving a wizard step that uses `EventFormFields`. */
export function triggerFieldsForWizardStep(step: WizardStepId): FieldPath<EventFormValues>[] | null {
  switch (step) {
    case "branding":
      return ["bannerImageUrl", "brandLogoUrl", "attendeeTheme", "brandPrimaryColor"];
    case "event_information":
      return ["name", "type"];
    case "schedule":
      return [
        "date",
        "endDate",
        "historicalMode",
        "scheduleMode",
        "multiDayDays",
        "multiDayVirtualLinkMode",
        "multiDayRegistrationPolicy",
        "multiDayCheckInPolicy",
        "multiDayShowAgendaPublic",
        "multiDayAllowStaffCheckInOutsideSession"
      ];
    case "venue":
      return ["locationId", "capacity", "enableVirtual", "virtualCapacity", "zoomSessionKind"];
    default:
      return null;
  }
}
