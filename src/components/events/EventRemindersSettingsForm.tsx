"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EventStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type SubmitErrorHandler } from "react-hook-form";

import { EventFormFields, type EventFormFieldsSection } from "@/components/events/EventFormFields";
import { firstValidationMessage, sessionRowErrorSummary } from "@/components/events/eventFormErrors";
import {
  eventFormSchema,
  type EventFormValues,
  getEventFormDefaultValues,
  type EventLocationOption
} from "@/components/events/eventFormSchema";
import { Button } from "@/components/ui/Button";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { updateEvent } from "@/lib/actions/event.actions";
import { buildCreateEventPayload } from "@/lib/events/eventFormPayload";
import { cn } from "@/lib/utils";

type EventRemindersSettingsFormProps = {
  eventId: string;
  eventStatus: EventStatus;
  locations: EventLocationOption[];
  defaultValues: Partial<EventFormValues>;
  zoomSessionKindLocked?: boolean;
};

const SECTIONS: EventFormFieldsSection[] = ["reminders"];

export function EventRemindersSettingsForm({
  eventId,
  eventStatus,
  locations,
  defaultValues,
  zoomSessionKindLocked = false
}: EventRemindersSettingsFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const locked = eventStatus === EventStatus.COMPLETED || eventStatus === EventStatus.CANCELLED;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: getEventFormDefaultValues(locations, defaultValues, null)
  });

  async function onSubmit(values: EventFormValues) {
    setFormError(null);
    const payload = buildCreateEventPayload(values);
    const result = await updateEvent(eventId, payload);
    if (!result.success) {
      setFormError(result.error ?? "Could not save.");
      return;
    }
    router.refresh();
  }

  const onInvalid: SubmitErrorHandler<EventFormValues> = (errs) => {
    setFormError(
      sessionRowErrorSummary(errs) ?? firstValidationMessage(errs) ?? "Please correct the highlighted fields."
    );
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className={cn("space-y-5", !locked && "max-w-2xl")}
    >
      {formError ? (
        <WorkspaceNotice variant="error" onDismiss={() => setFormError(null)}>
          {formError}
        </WorkspaceNotice>
      ) : null}
      <fieldset disabled={locked} className="min-w-0 border-0 p-0 disabled:cursor-not-allowed disabled:opacity-[0.88]">
        <EventFormFields
          form={form}
          locations={locations}
          locked={locked}
          mode="edit"
          eventId={eventId}
          eventStatus={eventStatus}
          zoomSessionKindLocked={zoomSessionKindLocked}
          defaultValues={defaultValues}
          activeSections={SECTIONS}
        />
      </fieldset>
      {!locked ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
            {form.formState.isSubmitting ? "Saving…" : "Save reminder settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
