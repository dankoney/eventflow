import { NextResponse } from "next/server";

import { syncEventStatuses } from "@/lib/lifecycle/syncEventStatuses";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const r = await syncEventStatuses(new Date());
  return NextResponse.json({ ok: true, ...r });
}
