"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = (eventId: string) =>
  [
    { href: `/events/${eventId}`, label: "Overview" },
    { href: `/events/${eventId}/guests`, label: "Guests" },
    { href: `/events/${eventId}/checkin`, label: "Check-in" },
    { href: `/events/${eventId}/analytics`, label: "Analytics" }
  ] as const;

type EventDetailTabsProps = {
  eventId: string;
};

export function EventDetailTabs({ eventId }: EventDetailTabsProps) {
  const pathname = usePathname();
  const items = tabs(eventId);

  return (
    <nav className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
      {items.map((tab) => {
        const active =
          tab.href === `/events/${eventId}`
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition",
              active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
