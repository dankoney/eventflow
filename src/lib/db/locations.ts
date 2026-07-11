import { prisma } from "@/lib/prisma";

export type LocationListItem = {
  id: string;
  name: string;
  address: string;
  capacity: number;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  facilityImageUrl: string | null;
  googlePlaceId: string | null;
  orgId: string;
  createdAt: Date;
};

export async function listLocationsForOrg(orgId: string): Promise<LocationListItem[]> {
  return prisma.location.findMany({
    where: { orgId },
    orderBy: { name: "asc" }
  });
}
