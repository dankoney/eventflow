import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function mapsKeyForOrg(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { googleMapsApiKey: true }
  });
  const k = org?.googleMapsApiKey?.trim();
  if (k) return k;
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

/** Proxies Google Static Maps so the API key stays server-side. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return new NextResponse("Invalid coordinates", { status: 400 });
  }

  const key = await mapsKeyForOrg(session.user.orgId);
  if (!key) {
    return new NextResponse("Maps not configured", { status: 503 });
  }

  const staticUrl = new URL("https://maps.googleapis.com/maps/api/staticmap");
  staticUrl.searchParams.set("center", `${lat},${lng}`);
  staticUrl.searchParams.set("zoom", "16");
  staticUrl.searchParams.set("size", "480x240");
  staticUrl.searchParams.set("scale", "2");
  staticUrl.searchParams.set("markers", `color:red|${lat},${lng}`);
  staticUrl.searchParams.set("key", key);

  const img = await fetch(staticUrl.toString());
  if (!img.ok) {
    return new NextResponse("Map provider error", { status: 502 });
  }
  const contentType = img.headers.get("content-type") ?? "image/png";
  const body = await img.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300"
    }
  });
}
