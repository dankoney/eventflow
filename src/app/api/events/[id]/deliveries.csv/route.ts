import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { deliveryLogCsvBody, sanitizeCsvFilename } from "@/lib/delivery/csvExport";
import { getEventDeliveryReport } from "@/lib/delivery/eventDeliveryReport";
import { getEventForUser } from "@/lib/db/events";
import { canManageEventGuests } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageEventGuests(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role
  );
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const report = await getEventDeliveryReport(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role,
    { limit: 5000 }
  );
  if (!report) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const csvBody = deliveryLogCsvBody(report.deliveries, {
    eventName: event.name,
    generatedAt: new Date()
  });
  const filename = sanitizeCsvFilename(`${event.name}-deliveries.csv`);

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
