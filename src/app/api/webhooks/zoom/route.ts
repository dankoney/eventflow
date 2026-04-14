import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Phase 6+ will process participant events and update join/check-in states.
  return NextResponse.json({ received: true, event: body?.event ?? null });
}
