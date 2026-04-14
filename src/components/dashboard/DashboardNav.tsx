"use client";

import {
  BarChart3,
  Calendar,
  LayoutDashboard,
  ScanLine,
  Settings,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const items = (role: Role) => [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/events",
    label: role === "SALES_REP" ? "My Events" : "Events",
    icon: Calendar
  },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/checkin", label: "Check-in", icon: ScanLine },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

type DashboardNavProps = {
  role: Role;
};

export function DashboardNav({ role }: DashboardNavProps) {
  const pathname = usePathname();
  const navItems = items(role);

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-200/80"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
