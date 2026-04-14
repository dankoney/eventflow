import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Org users with sales rep role (for assigning guests). */
export async function listSalesReps(orgId: string) {
  return prisma.user.findMany({
    where: { orgId, role: Role.SALES_REP },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" }
  });
}
