import { Plus_Jakarta_Sans } from "next/font/google";
import { Role } from "@prisma/client";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventDetailTabs } from "@/components/events/EventDetailTabs";
import { getEventForUser } from "@/lib/db/events";
import { getEnabledModules } from "@/lib/features/modules";
import { cn, formatEventPeriod, formatLocationLine } from "@/lib/utils";

const eventDashboardFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-event-dashboard",
  display: "swap",
  weight: ["400", "500", "600", "700"]
});

type EventLayoutProps = {
  children: ReactNode;
  params: { id: string };
};

export default async function EventDetailLayout({ children, params }: EventLayoutProps) {
  const session = await auth();
  if (!session?.user?.orgId) redirect("/login");

  const event = await getEventForUser(
    params.id,
    session.user.orgId,
    session.user.id,
    session.user.role,
    session.sessionId
  );
  if (!event) return notFound();

  const canEdit = session.user.role === Role.ADMIN || session.user.role === Role.MARKETING;
  const enabledModules = getEnabledModules();

  return (
    <div className={cn(eventDashboardFont.variable, "font-event antialiased")}>
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-zinc-950/40">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.07)_0%,transparent_45%,rgba(255,255,255,0.04)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.07)_1px,transparent_0)] [background-size:24px_24px]"
            aria-hidden
          />

          <div className="relative px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
              <Link
                href="/events"
                className="inline-flex items-center gap-1 rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              >
                Events
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
              <span className="truncate text-zinc-300" title={event.name}>
                {event.name}
              </span>
            </div>

            <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
              {event.name}
            </h1>

            <div className="mt-5 flex max-w-3xl flex-col gap-3 text-sm text-zinc-300 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
              <span className="inline-flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <CalendarDays className="h-4 w-4 text-zinc-300" aria-hidden />
                </span>
                <span className="leading-snug">{formatEventPeriod(event.date, event.endDate)}</span>
              </span>
              <span className="hidden h-4 w-px bg-zinc-700 sm:block" aria-hidden />
              <span className="inline-flex min-w-0 items-start gap-2.5 sm:items-center">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 sm:mt-0">
                  <MapPin className="h-4 w-4 text-zinc-300" aria-hidden />
                </span>
                <span className="min-w-0 leading-snug text-zinc-200">{formatLocationLine(event.location)}</span>
              </span>
            </div>

            <EventDetailTabs
              eventId={event.id}
              canEdit={canEdit}
              role={session.user.role}
              enabledModules={enabledModules}
              variant="command"
            />
          </div>
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
