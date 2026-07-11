"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type EventSettingsSubnavProps = {
  eventId: string;
};

const links = (eventId: string) => [
  { href: `/events/${eventId}/settings`, label: "Connect & reminders", exact: true },
  { href: `/events/${eventId}/settings/team`, label: "Team", exact: false }
];

export function EventSettingsSubnav({ eventId }: EventSettingsSubnavProps) {
  const pathname = usePathname();
  const items = links(eventId);

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1"
      aria-label="Settings sections"
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium transition",
              active ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:text-zinc-900"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
