"use client";

import { CommandCenterUrlCard } from "@/components/events/CommandCenterUrlCard";
import { DoorDashboardCard } from "@/components/events/DoorDashboardCard";
import { LaunchZoomHostPanel } from "@/components/events/LaunchZoomHostPanel";
import { WalkInCheckInBoothCard } from "@/components/events/WalkInCheckInBoothCard";

type Props = {
  eventId: string;
  commandCenterUrl: string | null;
  checkInBoothUrl: string | null;
  orgSlug: string;
  allowFlashEntry: boolean;
  eventIsLive: boolean;
  boothOpen: boolean;
  boothStatusMessage: string;
  isOnsiteEvent: boolean;
  canHostZoom: boolean;
  hasZoomRoom: boolean;
  zoomStartUrl: string | null;
  zoomJoinUrl: string | null;
  layout?: "stack" | "publish";
};

/**
 * Command Center URL + Zoom host start — grouped for overview sidebar and publish tab.
 */
export function EventLiveOpsPanel({
  eventId,
  commandCenterUrl,
  checkInBoothUrl,
  orgSlug,
  allowFlashEntry,
  eventIsLive,
  boothOpen,
  boothStatusMessage,
  isOnsiteEvent,
  canHostZoom,
  hasZoomRoom,
  zoomStartUrl,
  zoomJoinUrl,
  layout = "stack"
}: Props) {
  const stackClass = layout === "publish" ? "max-w-2xl space-y-5" : "space-y-5";

  return (
    <div className={stackClass}>
      <DoorDashboardCard eventId={eventId} eventIsLive={eventIsLive} isOnsiteEvent={isOnsiteEvent} />
      <WalkInCheckInBoothCard
        boothUrl={checkInBoothUrl}
        allowFlashEntry={allowFlashEntry}
        boothOpen={boothOpen}
        boothStatusMessage={boothStatusMessage}
        isOnsiteEvent={isOnsiteEvent}
      />
      <CommandCenterUrlCard
        commandCenterUrl={commandCenterUrl}
        orgSlug={orgSlug}
        allowFlashEntry={allowFlashEntry}
        layout={layout === "publish" ? "default" : "rail"}
      />
      <LaunchZoomHostPanel
        zoomStartUrl={zoomStartUrl}
        zoomJoinUrl={zoomJoinUrl}
        canHost={canHostZoom}
        hasZoomRoom={hasZoomRoom}
        variant={layout === "publish" ? "card" : "rail"}
      />
    </div>
  );
}
