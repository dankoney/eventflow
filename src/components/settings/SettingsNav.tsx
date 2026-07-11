"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type SettingsNavTab = {
  id: string;
  label: string;
  href: string;
  show: boolean;
};

type SettingsNavProps = {
  isAdmin: boolean;
  canManageLocations: boolean;
  canManageStaffDirectory: boolean;
};

/**
 * Shared settings subnav — tab query routes + ADMIN-only Billing page link.
 */
export function SettingsNav({
  isAdmin,
  canManageLocations,
  canManageStaffDirectory
}: SettingsNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "general";
  const legacyMap: Record<string, string> = {
    profile: "general",
    organization: "general",
    staff: "contacts"
  };
  const activeTab = legacyMap[rawTab] ?? rawTab;
  const onBilling = pathname.startsWith("/dashboard/settings/billing");

  const tabs: SettingsNavTab[] = [
    { id: "general", label: "General", href: "/dashboard/settings?tab=general", show: true },
    { id: "users", label: "Users", href: "/dashboard/settings?tab=users", show: isAdmin },
    {
      id: "contacts",
      label: "CRM defaults",
      href: "/dashboard/settings?tab=contacts",
      show: canManageStaffDirectory
    },
    {
      id: "integrations",
      label: "Integrations",
      href: "/dashboard/settings?tab=integrations",
      show: isAdmin
    },
    {
      id: "locations",
      label: "Locations",
      href: "/dashboard/settings?tab=locations",
      show: canManageLocations
    },
    {
      id: "billing",
      label: "Billing",
      href: "/dashboard/settings/billing",
      show: isAdmin
    }
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs
        .filter((t) => t.show)
        .map((t) => {
          const isActive = t.id === "billing" ? onBilling : !onBilling && activeTab === t.id;
          return (
            <Link
              key={t.id}
              href={t.href}
              scroll={false}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}
