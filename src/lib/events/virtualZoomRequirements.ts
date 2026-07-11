import { EventType } from "@prisma/client";

/** True when the program delivery format requires org Zoom Server-to-Server OAuth. */
export function eventRequiresVirtualZoomIntegration(type: EventType): boolean {
  return type === EventType.VIRTUAL || type === EventType.HYBRID;
}

/** True when virtual seats / Zoom session provisioning apply to this event. */
export function eventHasVirtualAllocation(type: EventType, virtualCapacity: number): boolean {
  return eventRequiresVirtualZoomIntegration(type) && virtualCapacity > 0;
}
