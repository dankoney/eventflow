import { redirect } from "next/navigation";

import { acceptGuestInvitationByToken } from "@/lib/actions/guest.actions";

type Props = {
  params: { guestId: string; token: string };
};

/** One-time accept link from organizer invitation email (INVITED → ACCEPTED). */
export default async function GuestInviteAcceptPage({ params }: Props) {
  const res = await acceptGuestInvitationByToken({
    guestId: params.guestId,
    token: params.token
  });
  if (!res.success) {
    redirect(`/join/${params.guestId}?invite=invalid`);
  }
  redirect(`/join/${params.guestId}?invite=accepted`);
}
