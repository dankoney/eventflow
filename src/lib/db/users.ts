import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Users that can be assigned as guest owners (field sales / staff). */
export async function listAssignableReps(orgId: string) {
  return prisma.user.findMany({
    where: { orgId, role: { in: [Role.STAFF, Role.SALES_REF] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" }
  });
}
