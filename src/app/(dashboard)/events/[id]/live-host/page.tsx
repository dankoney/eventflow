import { redirect } from "next/navigation";

type PageProps = { params: { id: string } };

/** Browser-based Meeting SDK host view removed — send admins to the event overview. */
export default function EventLiveHostPage({ params }: PageProps) {
  redirect(`/events/${params.id}`);
}
