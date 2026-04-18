import { NextResponse } from "next/server";

type RouteContext = { params: { guestId: string } };

/** Legacy path — canonical gateway is `/join/[guestId]/open-zoom`. */
export async function GET(request: Request, context: RouteContext) {
  const { guestId } = context.params;
  const u = new URL(request.url);
  u.pathname = `/join/${guestId}/open-zoom`;
  u.search = "";
  return NextResponse.redirect(u.toString(), 307);
}
