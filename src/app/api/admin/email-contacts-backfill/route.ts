import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { runEmailContactsBackfill } from "@/lib/email/backfillEmailContacts";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursorGuestId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  orgId: z.string().min(1).optional(),
  syncToResend: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  resendDelayMs: z.coerce.number().int().min(50).max(5000).optional()
});

/**
 * Admin backfill for marketing email contacts.
 *
 * Auth (either):
 * - `Authorization: Bearer $CRON_SECRET` (automation / scripts)
 * - Signed-in platform owner session
 *
 * Example:
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://HOST/api/admin/email-contacts-backfill?limit=50&syncToResend=false"
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  const bearerOk = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let adminOk = false;
  if (!bearerOk) {
    const session = await auth();
    adminOk = Boolean(session?.user?.isPlatformOwner);
  }

  if (!bearerOk && !adminOk) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const result = await runEmailContactsBackfill(parsed.data);

  return NextResponse.json({
    ok: true,
    ...result,
    nextCursorGuestId:
      result.scanned > 0 ? result.results[result.results.length - 1]?.guestId : undefined
  });
}
