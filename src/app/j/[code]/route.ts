import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getJoinPageAbsoluteUrl } from "@/lib/url";

type RouteContext = {
  params: { code: string };
};

/**
 * Short registration pass link for SMS (`/j/Ab3xY9` → `/join/[guestId]`).
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const code = params.code?.trim();
  if (!code) {
    return new NextResponse("Not found", { status: 404 });
  }

  const guest = await prisma.guest.findFirst({
    where: { joinSmsCode: code },
    select: { id: true }
  });
  if (!guest) {
    return new NextResponse("Not found", { status: 404 });
  }

  const absolute = getJoinPageAbsoluteUrl(guest.id);
  if (!absolute) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(absolute, 302);
}
