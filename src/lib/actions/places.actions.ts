"use server";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchPlaceAutocomplete, fetchPlaceDetails } from "@/lib/places/googlePlacesServer";
import type { ActionResult } from "@/types";

async function resolveMapsApiKey(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { googleMapsApiKey: true }
  });
  const k = org?.googleMapsApiKey?.trim();
  if (k) return k;
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

function canUsePlaces(role: Role) {
  return role === Role.ADMIN || role === Role.MARKETING;
}

export async function googlePlacesAutocomplete(
  input: string
): Promise<ActionResult<{ placeId: string; description: string }[]>> {
  const session = await auth();
  if (!session?.user?.orgId || !canUsePlaces(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const key = await resolveMapsApiKey(session.user.orgId);
  if (!key) {
    return {
      success: false,
      error: "Add a Google Maps API key under Settings → Integrations (Google Maps), or set GOOGLE_MAPS_API_KEY on the server."
    };
  }
  const r = await fetchPlaceAutocomplete(key, input);
  if (!r.ok) return { success: false, error: r.error };
  return { success: true, data: r.predictions };
}

export async function googlePlaceDetails(placeId: string): Promise<
  ActionResult<{
    formattedAddress: string;
    latitude: number;
    longitude: number;
    city: string | null;
    googlePlaceId: string;
  }>
> {
  const session = await auth();
  if (!session?.user?.orgId || !canUsePlaces(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const key = await resolveMapsApiKey(session.user.orgId);
  if (!key) {
    return { success: false, error: "Google Maps API key is not configured." };
  }
  const r = await fetchPlaceDetails(key, placeId);
  if (!r.ok) return { success: false, error: r.error };
  return { success: true, data: r.details };
}
