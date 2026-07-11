"use client";

import { useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/Card";
import type { LocationListItem } from "@/lib/db/locations";

import { IntegrationsHub, type IntegrationsHubProps } from "./IntegrationsHub";
import { LocationsPanel } from "./LocationsPanel";
import {
  OrganizationEventBrandingForm,
  OrganizationMarketingForm,
  OrganizationNewEventDefaultsForm,
  OrganizationWorkspaceForm,
  type OrganizationFormDefaults,
  type OrganizationMarketingDefaults
} from "./OrganizationForm";
import { ProfileForm } from "./ProfileForm";
import { CrmOrgDefaultsForm } from "./CrmOrgDefaultsForm";
import { SettingsNav } from "./SettingsNav";
import { UserManagementPanel, type OrgUserRow } from "./UserManagementPanel";

const VALID_TABS = ["general", "users", "contacts", "integrations", "locations"] as const;
type TabId = (typeof VALID_TABS)[number];

const LEGACY_TAB_MAP: Record<string, TabId> = {
  profile: "general",
  organization: "general",
  staff: "contacts"
};

type SettingsTabsProps = {
  userEmail: string;
  defaultUserName: string | null;
  orgName: string;
  orgSlug: string;
  orgEventDefaults: OrganizationFormDefaults;
  isAdmin: boolean;
  canManageLocations: boolean;
  integrations: IntegrationsHubProps;
  locations: LocationListItem[];
  orgUsers: OrgUserRow[];
  canManageStaffDirectory: boolean;
  defaultStaffCategoryLabelsCsv: string;
  defaultInternalStaffFooterContact: string | null;
  marketingDefaults: OrganizationMarketingDefaults;
};

export function SettingsTabs({
  userEmail,
  defaultUserName,
  orgName,
  orgSlug,
  orgEventDefaults,
  isAdmin,
  canManageLocations,
  integrations,
  locations,
  orgUsers,
  canManageStaffDirectory,
  defaultStaffCategoryLabelsCsv,
  defaultInternalStaffFooterContact,
  marketingDefaults
}: SettingsTabsProps) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab") ?? "general";
  const mapped = LEGACY_TAB_MAP[raw] ?? raw;
  const active: TabId = VALID_TABS.includes(mapped as TabId) ? (mapped as TabId) : "general";

  return (
    <div className="space-y-6">
      <SettingsNav
        isAdmin={isAdmin}
        canManageLocations={canManageLocations}
        canManageStaffDirectory={canManageStaffDirectory}
      />

      {active === "general" ? (
        <div className="space-y-6">
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
                {isAdmin ? "Workspace name and slug." : "Only admins can edit organization details."}
              </p>
              <div className="mt-6 max-w-md">
                {isAdmin ? (
                  <OrganizationWorkspaceForm defaultName={orgName} slug={orgSlug} />
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
                  </dl>
                )}
              </div>
            </Card>
          </div>
          {isAdmin ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-slate-900">Default event branding</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Logo, banner, primary/secondary/tertiary colors, and page template for new programs and staff notices.
                  Organizers can override per event.
                </p>
                <div className="mt-6 max-w-md">
                  <OrganizationEventBrandingForm eventDefaults={orgEventDefaults} />
                </div>
              </Card>
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-slate-900">New event defaults</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Default virtual capacity and Zoom session type when creating events. Organizers can change these per
                  event.
                </p>
                <div className="mt-6 max-w-md">
                  <OrganizationNewEventDefaultsForm eventDefaults={orgEventDefaults} />
                </div>
              </Card>
              <Card className="p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900">Marketing email consent</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Optional opt-in checkbox on registration and RSVP. Separate from transactional event emails.
                </p>
                <div className="mt-6 max-w-lg">
                  <OrganizationMarketingForm defaults={marketingDefaults} />
                </div>
              </Card>
            </div>
          ) : null}
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

      {active === "contacts" && canManageStaffDirectory ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">CRM defaults</h2>
          <p className="mt-1 text-sm text-slate-600">
            People, stakeholders, and segments live in the CRM hub. Keep lightweight org-wide presets here for wizard
            filters and internal check-in copy.
          </p>
          <div className="mt-6">
            <CrmOrgDefaultsForm
              defaultCategoryLabelsCsv={defaultStaffCategoryLabelsCsv}
              defaultFooterContact={defaultInternalStaffFooterContact}
            />
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
