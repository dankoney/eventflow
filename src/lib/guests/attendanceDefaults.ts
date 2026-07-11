import { AttendMode, EventType } from "@prisma/client";

/** Organizer-added guests: hybrid events leave mode unset until check-in or virtual join. */
export function initialModeForOrganizerGuest(event: { type: EventType; virtualCapacity: number }): AttendMode | null {
  if (event.type === EventType.HYBRID) return null;
  if (event.type === EventType.VIRTUAL) return AttendMode.VIRTUAL;
  return AttendMode.IN_PERSON;
}
