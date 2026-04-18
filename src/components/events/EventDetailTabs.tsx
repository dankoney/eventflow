"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

function tabsFor(eventId: string, canEdit: boolean) {
  const base = [
    { href: `/events/${eventId}`, label: "Overview" },
    { href: `/events/${eventId}/guests`, label: "Guests" },
    { href: `/events/${eventId}/checkin`, label: "Check-in" },
    { href: `/events/${eventId}/analytics`, label: "Analytics" }
  ] as const;
  if (!canEdit) return [...base];
  return [
    ...base.slice(0, 1),
    { href: `/events/${eventId}/edit`, label: "Edit" },
    ...base.slice(1)
  ];
}

type EventDetailTabsProps = {
  eventId: string;
  canEdit?: boolean;
};

export function EventDetailTabs({ eventId, canEdit = false }: EventDetailTabsProps) {
  const pathname = usePathname();
  const items = tabsFor(eventId, canEdit);

  return (
    <nav className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
      {items.map((tab) => {
        const active =
          tab.href === `/events/${eventId}` || tab.href === `/events/${eventId}/edit`
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
