import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getEventForUser } from "@/lib/db/events";
import { getPollTallyForEvent } from "@/lib/db/pollTally";
import { isModuleEnabled } from "@/lib/features/modules";
import { canManageEvents } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only CSV export of the live poll tally. Includes:
 *   - One header block (poll, turnout, generated-at)
 *   - One row per (position, candidate) with votes + share%
 *   - Confidence rows for unopposed positions
 *
 * Anonymized — there is no voter dimension. The Vote table never references guests.
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

  const tally = await getPollTallyForEvent(event.id);
  if (!tally) {
    return NextResponse.json({ error: "No poll configured for this event." }, { status: 404 });
  }

  void req;

  const rows: string[] = [];
  rows.push(`Poll,${csv(tally.title)}`);
  rows.push(`Event,${csv(event.name)}`);
  rows.push(`Window opens,${csv(tally.startTime.toISOString())}`);
  rows.push(`Window closes,${csv(tally.endTime.toISOString())}`);
  rows.push(`Eligible voters,${tally.turnout.totalGuests}`);
  rows.push(`Ballots cast,${tally.turnout.ballotsCast}`);
  rows.push(`Turnout (%),${tally.turnout.turnoutPct}`);
  rows.push(`Generated at,${csv(new Date().toISOString())}`);
  rows.push("");
  rows.push(["Position", "Contest type", "Candidate / outcome", "Votes", "Share (%)"].map(csv).join(","));

  for (const position of tally.positions) {
    if (position.isUnopposed) {
      const conf = position.confidence ?? { yes: 0, no: 0, abstain: 0 };
      const total = conf.yes + conf.no + conf.abstain;
      const yesPct = total > 0 ? Math.round((conf.yes / total) * 100) : 0;
      const noPct = total > 0 ? Math.round((conf.no / total) * 100) : 0;
      const abstainPct = total > 0 ? Math.round((conf.abstain / total) * 100) : 0;
      const sole = position.candidates[0]?.name ?? "";
      rows.push(
        [
          csv(position.title),
          csv("Unopposed"),
          csv(sole ? `Yes (${sole})` : "Yes"),
          conf.yes.toString(),
          yesPct.toString()
        ].join(",")
      );
      rows.push(
        [csv(position.title), csv("Unopposed"), csv("No"), conf.no.toString(), noPct.toString()].join(",")
      );
      rows.push(
        [
          csv(position.title),
          csv("Unopposed"),
          csv("Abstain"),
          conf.abstain.toString(),
          abstainPct.toString()
        ].join(",")
      );
      continue;
    }
    const sorted = [...position.candidates].sort((a, b) => b.votes - a.votes);
    if (sorted.length === 0) {
      rows.push([csv(position.title), csv("Opposed"), csv("(no candidates)"), "0", "0"].join(","));
      continue;
    }
    for (const c of sorted) {
      rows.push(
        [
          csv(position.title),
          csv("Opposed"),
          csv(c.name),
          c.votes.toString(),
          c.sharePct.toString()
        ].join(",")
      );
    }
  }

  const body = rows.join("\r\n");
  /** Lead with a BOM so Excel detects UTF-8 correctly. */
  const csvBody = `\uFEFF${body}`;
  const filename = sanitizeFilename(`${event.name}-poll-results.csv`);

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
  return input.replace(/[^\w.\- ]+/g, "").trim() || "poll-results.csv";
}
