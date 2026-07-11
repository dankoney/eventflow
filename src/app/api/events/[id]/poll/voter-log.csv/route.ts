import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getEventForUser } from "@/lib/db/events";
import { getVoterLogForEvent } from "@/lib/db/voterLog";
import { isModuleEnabled } from "@/lib/features/modules";
import { canManageEvents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only CSV export of the attributed voter log. Only meaningful when the poll
 * was set to `isAnonymous = false`; for anonymous polls we return a 409 with a
 * clear message rather than an empty CSV. Each row is one (guest, position)
 * selection so the file can be pivoted in Excel/Sheets.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isModuleEnabled("polling")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageEvents(session.user.role)) {
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

  const poll = await prisma.poll.findUnique({
    where: { eventId: event.id },
    select: { isAnonymous: true }
  });
  if (!poll) {
    return NextResponse.json({ error: "No poll configured for this event." }, { status: 404 });
  }
  if (poll.isAnonymous) {
    return NextResponse.json(
      {
        error:
          "This poll is anonymous — no per-voter attribution exists. Export the tally instead."
      },
      { status: 409 }
    );
  }

  const entries = await getVoterLogForEvent(event.id);

  void req;

  const rows: string[] = [];
  rows.push(`Poll voter log,${csv(event.name)}`);
  rows.push(`Generated at,${csv(new Date().toISOString())}`);
  rows.push(`Ballots recorded,${entries.length}`);
  rows.push("");
  rows.push(
    ["Guest name", "Guest email", "Position", "Selection", "Submitted at", "Receipt"].map(csv).join(",")
  );
  for (const entry of entries) {
    for (const choice of entry.choices) {
      rows.push(
        [
          csv(entry.guestName),
          csv(entry.guestEmail),
          csv(choice.positionTitle),
          csv(choice.selection),
          csv(entry.votedAt.toISOString()),
          csv(entry.receiptRef)
        ].join(",")
      );
    }
  }

  const body = rows.join("\r\n");
  const csvBody = `\uFEFF${body}`;
  const filename = sanitizeFilename(`${event.name}-voter-log.csv`);

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

function csv(value: string | number | null | undefined): string {
  const v = value == null ? "" : String(value);
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function sanitizeFilename(input: string): string {
  return input.replace(/[^\w.\- ]+/g, "").trim() || "voter-log.csv";
}
