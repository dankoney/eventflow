import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getEventFeedbackAbsoluteUrl } from "@/lib/url";

type RouteContext = {
  params: { code: string };
};

/**
 * Short feedback link for SMS (`/f/Ab3xY9` → `/feedback/[guestId]/[token]`).
 * Preserves optional `?rating=` from email-style one-tap links.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const code = params.code?.trim();
  if (!code) {
    return new NextResponse("Not found", { status: 404 });
  }

  const guest = await prisma.guest.findFirst({
    where: { feedbackSmsCode: code },
    select: { id: true, feedbackToken: true }
  });
  if (!guest?.feedbackToken) {
    return new NextResponse("Not found", { status: 404 });
  }

  const absolute = getEventFeedbackAbsoluteUrl(guest.id, guest.feedbackToken, request);
  if (!absolute) {
    return new NextResponse("Not found", { status: 404 });
  }

  const destination = new URL(absolute);
  const rating = new URL(request.url).searchParams.get("rating");
  if (rating) {
    destination.searchParams.set("rating", rating);
  }

  return NextResponse.redirect(destination, 302);
}
