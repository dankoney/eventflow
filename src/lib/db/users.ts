import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Users that can be assigned to event teams or as guest owners. */
export async function listAssignableReps(orgId: string) {
  return prisma.user.findMany({
    where: { orgId, role: { in: [Role.STAFF, Role.SALES_REP] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" }
  });
}
