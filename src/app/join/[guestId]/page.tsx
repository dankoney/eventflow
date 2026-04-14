import { notFound } from "next/navigation";

import { VirtualJoinPanel } from "@/components/join/VirtualJoinPanel";
import { getGuestJoinContext } from "@/lib/db/guests";

type JoinPageProps = {
  params: { guestId: string };
};

export async function generateMetadata({ params }: JoinPageProps) {
  const ctx = await getGuestJoinContext(params.guestId);
  if (!ctx) {
    return { title: "Join · Eventflow" };
  }
  return {
    title: `${ctx.eventName} · ${ctx.mode === "VIRTUAL" ? "Virtual join" : "Event"} · Eventflow`
  };
}

export default async function JoinPage({ params }: JoinPageProps) {
  const ctx = await getGuestJoinContext(params.guestId);
  if (!ctx) notFound();

  return (
    <main className="mx-auto min-h-[60vh] max-w-2xl px-4 py-10">
      <VirtualJoinPanel
        guestId={params.guestId}
        guestName={ctx.guestName}
        mode={ctx.mode}
        status={ctx.status}
        zoomLink={ctx.zoomLink}
        eventName={ctx.eventName}
        eventDateIso={ctx.eventDate.toISOString()}
        eventLocation={ctx.eventLocation}
        zoomMeetingId={ctx.zoomMeetingId}
        zoomPasscode={ctx.zoomPasscode}
        organizationName={ctx.organizationName}
      />
    </main>
  );
}
