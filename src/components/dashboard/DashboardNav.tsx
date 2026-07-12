"use client";

import {
  BarChart3,
  Building2,
  Calendar,
  FolderOpen,
  LayoutDashboard,
  Megaphone,
  Network,
  ScanLine,
  Send,
  Settings,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  canManageCrm,
  canBlastGuests,
  canManageEventGuests,
  canUseMediaLibrary,
  canViewDeliveryReports,
  canViewFeedbackAnalytics
} from "@/lib/rbac/capabilities";
import type { EnabledModules } from "@/lib/features/modules";
import { isEventLinkedRole, isOrgWideRole } from "@/lib/rbac/types";
import { cn } from "@/lib/utils";
import { Role } from "@prisma/client";

const items = (role: Role, isPlatformOwner: boolean, enabledModules: EnabledModules) => {
  const base: Array<{ href: string; label: string; icon: typeof LayoutDashboard }> = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      href: "/events",
      label: isEventLinkedRole(role) ? "My Events" : "Events",
      icon: Calendar
    }
  ];
  if (enabledModules.crm && canManageCrm(role)) {
    base.push({ href: "/crm", label: "CRM", icon: Building2 });
  }
  if (enabledModules.broadcast && canBlastGuests(role)) {
    base.push({ href: "/broadcasts", label: "Broadcasts", icon: Megaphone });
  }
  if (enabledModules.media && canUseMediaLibrary(role)) {
    base.push({ href: "/media", label: "Media", icon: FolderOpen });
  }
  if (canManageEventGuests(role)) {
    base.push({ href: "/guests", label: "Guests", icon: Users });
  }
  base.push({ href: "/checkin", label: "Check-in", icon: ScanLine });
  if (enabledModules.deliveries && canViewDeliveryReports(role)) {
    base.push({ href: "/deliveries", label: "Deliveries", icon: Send });
  }
  if (enabledModules.analytics && (canViewFeedbackAnalytics(role) || isOrgWideRole(role))) {
    base.push({ href: "/analytics", label: "Analytics", icon: BarChart3 });
  }
  base.push({ href: "/dashboard/settings", label: "Settings", icon: Settings });
  if (isPlatformOwner) {
    base.push({ href: "/superadmin", label: "Platform", icon: Network });
  }
  return base;
};

type DashboardNavProps = {
  role: Role;
  isPlatformOwner?: boolean;
  enabledModules: EnabledModules;
  onNavigate?: () => void;
};

export function DashboardNav({ role, isPlatformOwner = false, enabledModules, onNavigate }: DashboardNavProps) {
  const pathname = usePathname();
  const navItems = items(role, isPlatformOwner, enabledModules);

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : item.href === "/dashboard/settings"
              ? pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings")
              : item.href === "/crm"
                ? pathname === "/crm" || pathname.startsWith("/crm/")
                : item.href === "/broadcasts"
                  ? pathname === "/broadcasts" || pathname.startsWith("/broadcasts/")
                  : item.href === "/media"
                  ? pathname === "/media" || pathname.startsWith("/media/")
                  : item.href === "/deliveries"
                    ? pathname === "/deliveries" || pathname.startsWith("/deliveries/")
                    : item.href === "/superadmin"
                  ? pathname === "/superadmin" || pathname.startsWith("/superadmin/")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
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
