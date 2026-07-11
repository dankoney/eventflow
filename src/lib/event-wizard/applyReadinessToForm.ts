import type { UseFormReturn } from "react-hook-form";

import type { EventFormValues } from "@/components/events/eventFormSchema";
import type { ReadinessIssue } from "@/lib/event-wizard/readiness";

export function applyReadinessFieldErrors(
  form: UseFormReturn<EventFormValues>,
  issues: ReadinessIssue[]
): string | null {
  const blockers = issues.filter((i) => i.severity === "block");
  let firstPath: keyof EventFormValues | null = null;

  for (const issue of blockers) {
    if (issue.field) {
      form.setError(issue.field, { type: "manual", message: issue.message });
      if (!firstPath) firstPath = issue.field;
    }
  }

  if (blockers.length === 0) return null;
  const summary = blockers.map((i) => i.message).join(" ");
  return firstPath ? summary : blockers[0]?.message ?? "Resolve blocking items before continuing.";
}

export function clearReadinessFieldErrors(form: UseFormReturn<EventFormValues>) {
  const fields: (keyof EventFormValues)[] = [
    "name",
    "locationId",
    "date",
    "endDate",
    "type",
    "virtualCapacity",
    "enableVirtual",
    "zoomSessionKind",
    "bannerImageUrl",
    "brandLogoUrl",
    "brandPrimaryColor"
  ];
  for (const f of fields) {
    form.clearErrors(f);
  }
}
