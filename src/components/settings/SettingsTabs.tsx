"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { LocationListItem } from "@/lib/db/locations";

import { IntegrationsHub, type IntegrationsHubProps } from "./IntegrationsHub";
import { LocationsPanel } from "./LocationsPanel";
import { OrganizationForm } from "./OrganizationForm";
import { ProfileForm } from "./ProfileForm";
import { UserManagementPanel, type OrgUserRow } from "./UserManagementPanel";

const VALID_TABS = ["general", "users", "integrations", "locations"] as const;
type TabId = (typeof VALID_TABS)[number];

const LEGACY_TAB_MAP: Record<string, TabId> = {
  profile: "general",
  organization: "general"
};

type SettingsTabsProps = {
  userEmail: string;
  defaultUserName: string | null;
  orgName: string;
  orgSlug: string;
  orgLogo: string | null;
  isAdmin: boolean;
  canManageLocations: boolean;
  integrations: IntegrationsHubProps;
  locations: LocationListItem[];
  orgUsers: OrgUserRow[];
};

function tabHref(tab: TabId) {
  return `/dashboard/settings?tab=${tab}`;
}

export function SettingsTabs({
  userEmail,
  defaultUserName,
  orgName,
  orgSlug,
  orgLogo,
  isAdmin,
  canManageLocations,
  integrations,
  locations,
  orgUsers
}: SettingsTabsProps) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab") ?? "general";
  const mapped = LEGACY_TAB_MAP[raw] ?? raw;
  const active: TabId = VALID_TABS.includes(mapped as TabId) ? (mapped as TabId) : "general";

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "general", label: "General", show: true },
    { id: "users", label: "Users", show: isAdmin },
    { id: "integrations", label: "Integrations", show: isAdmin },
    { id: "locations", label: "Locations", show: canManageLocations }
  ];

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs
          .filter((t) => t.show)
          .map((t) => {
            const isActive = active === t.id;
            return (
              <Link
                key={t.id}
                href={tabHref(t.id)}
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

      {active === "general" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
            <p className="mt-1 text-sm text-slate-600">Your account details.</p>
            <div className="mt-6 max-w-md">
              <ProfileForm email={userEmail} defaultName={defaultUserName} />
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900">Organization</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isAdmin
                ? "Company name and logo appear where your workspace is shown."
                : "Only admins can edit organization details."}
            </p>
            <div className="mt-6 max-w-md">
              {isAdmin ? (
                <OrganizationForm defaultName={orgName} defaultLogo={orgLogo} slug={orgSlug} />
              ) : (
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Organization</dt>
                    <dd className="font-medium text-slate-900">{orgName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Slug</dt>
                    <dd className="font-mono text-slate-800">{orgSlug}</dd>
                  </div>
                  {orgLogo ? (
                    <div>
                      <dt className="text-slate-500">Logo</dt>
                      <dd>
                        <a href={orgLogo} className="text-sky-700 underline" target="_blank" rel="noreferrer">
                          {orgLogo}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {active === "users" && isAdmin ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Users</h2>
          <p className="mt-1 text-sm text-slate-600">Create accounts and assign roles for this organization.</p>
          <div className="mt-6">
            <UserManagementPanel users={orgUsers} />
          </div>
        </Card>
      ) : null}

      {active === "integrations" && isAdmin ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
          <p className="mt-1 text-sm text-slate-600">
            Connect Zoom, WhatsApp, Resend, and mNotify SMS. Test each connection below.
          </p>
          <div className="mt-6">
            <IntegrationsHub {...integrations} />
          </div>
        </Card>
      ) : null}

      {active === "locations" && canManageLocations ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Locations</h2>
          <p className="mt-1 text-sm text-slate-600">Pre-create venues and attach them to events.</p>
          <div className="mt-6">
            <LocationsPanel locations={locations} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
