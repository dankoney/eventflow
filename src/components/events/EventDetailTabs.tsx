"use client";

import {
  BarChart3,
  Globe2,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Pencil,
  QrCode,
  Send,
  Settings,
  Users,
  Vote
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";

import { isPublicEventExperienceEnabled } from "@/lib/features/publicEventExperience";
import type { EnabledModules } from "@/lib/features/modules";
import { isStaffRole } from "@/lib/rbac/types";
import { cn } from "@/lib/utils";

function tabsFor(eventId: string, canEdit: boolean, role: Role, enabledModules: EnabledModules) {
  const publicExperienceEnabled = isPublicEventExperienceEnabled();
  const base = [
    { href: `/events/${eventId}`, label: "Overview", icon: LayoutDashboard },
    { href: `/events/${eventId}/guests`, label: "Guests", icon: Users },
    { href: `/events/${eventId}/checkin`, label: "Check-in", icon: QrCode },
    ...(enabledModules.feedback
      ? [{ href: `/events/${eventId}/feedback`, label: "Feedback", icon: MessageSquareText }]
      : []),
    ...(enabledModules.deliveries
      ? [{ href: `/events/${eventId}/deliveries`, label: "Deliveries", icon: Send }]
      : []),
    ...(enabledModules.analytics
      ? [{ href: `/events/${eventId}/analytics`, label: "Analytics", icon: BarChart3 }]
      : [])
  ] as const;

  const filtered = isStaffRole(role)
    ? base.filter(
        (tab) =>
          tab.href !== `/events/${eventId}/feedback` &&
          tab.href !== `/events/${eventId}/deliveries` &&
          tab.href !== `/events/${eventId}/guests` &&
          tab.href !== `/events/${eventId}/analytics`
      )
    : [...base];

  if (!canEdit) return filtered;

  return [
    filtered[0],
    { href: `/events/${eventId}/edit`, label: "Edit", icon: Pencil },
    { href: `/events/${eventId}/publish`, label: "Publish", icon: Megaphone },
    ...(publicExperienceEnabled
      ? [{ href: `/events/${eventId}/public`, label: "Public experience", icon: Globe2 }]
      : []),
    ...filtered.slice(1),
    ...(enabledModules.polling
      ? [{ href: `/events/${eventId}/election`, label: "Poll", icon: Vote }]
      : []),
    { href: `/events/${eventId}/settings`, label: "Settings", icon: Settings }
  ];
}

type EventDetailTabsProps = {
  eventId: string;
  canEdit?: boolean;
  role: Role;
  enabledModules: EnabledModules;
  variant?: "surface" | "command";
};

export function EventDetailTabs({
  eventId,
  canEdit = false,
  role,
  enabledModules,
  variant = "surface"
}: EventDetailTabsProps) {
  const pathname = usePathname();
  const items = tabsFor(eventId, canEdit, role, enabledModules);

  const isActive = (href: string) => {
    if (href === `/events/${eventId}/settings`) {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    if (
      href === `/events/${eventId}` ||
      href === `/events/${eventId}/edit` ||
      href === `/events/${eventId}/publish` ||
      href === `/events/${eventId}/public` ||
      href === `/events/${eventId}/election`
    ) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (variant === "command") {
    return (
      <nav className="mt-8 border-t border-white/10 pt-4" aria-label="Event sections">
        <ul className="flex snap-x snap-mandatory gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
          {items.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;

            return (
              <li key={tab.href} className="min-w-[44%] shrink-0 snap-start sm:min-w-0">
                <Link
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:px-3.5",
                    active
                      ? "bg-white/10 text-white ring-1 ring-white/20"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      className="mt-5 flex flex-wrap gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1.5 shadow-sm shadow-slate-900/[0.03] backdrop-blur-sm"
      aria-label="Event sections"
    >
      {items.map((tab) => {
        const active = isActive(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150",
              active
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
