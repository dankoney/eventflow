import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { orgDeliveryLogCsvBody, sanitizeCsvFilename } from "@/lib/delivery/csvExport";
import { getOrgDeliveryReport } from "@/lib/delivery/orgDeliveryReport";
import { canManageEventGuests } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageEventGuests(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { name: true }
  });

  const report = await getOrgDeliveryReport(
    session.user.orgId,
    session.user.id,
    session.user.role,
    { deliveryLimit: 5000 }
  );

  const csvBody = orgDeliveryLogCsvBody(report.recentDeliveries, {
    orgLabel: org?.name ?? "Organization",
    generatedAt: new Date()
  });
  const filename = sanitizeCsvFilename(`${org?.name ?? "org"}-deliveries.csv`);

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
