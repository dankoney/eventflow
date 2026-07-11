import { InternalStaffCheckInMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getEventRegistrationAbsoluteUrl, getInternalStaffMagicCheckInUrl } from "@/lib/url";

type RouteContext = {
  params: { code: string };
};

/**
 * Short internal staff notice link for SMS (`/s/Ab3xY9` → personal or shared check-in URL).
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const code = params.code?.trim();
  if (!code) {
    return new NextResponse("Not found", { status: 404 });
  }

  const guest = await prisma.guest.findFirst({
    where: { staffNoticeSmsCode: code },
    select: {
      id: true,
      internalCheckInToken: true,
      event: {
        select: {
          id: true,
          internalStaffCheckInMode: true
        }
      }
    }
  });
  if (!guest) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { event } = guest;
  const personalMode = event.internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK;
  const absolute =
    personalMode && guest.internalCheckInToken
      ? getInternalStaffMagicCheckInUrl(event.id, guest.internalCheckInToken)
      : getEventRegistrationAbsoluteUrl(event.id);

  if (!absolute) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(absolute, 302);
}
