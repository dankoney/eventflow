"use client";

import { CrmContactKind, EventType, InternalStaffCheckInMode, StaffEmploymentStatus } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";

import type { InternalStaffNoticeSettings } from "@/components/event-wizard/InternalStaffNoticeForm";
import { InternalStaffNoticeForm } from "@/components/event-wizard/InternalStaffNoticeForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { InternalStaffAudience } from "@/lib/internalStaff/audience";

const MANUAL_CONTACT_PAGE_SIZE = 20;

export type StaffPolicyDirectoryMeta = {
  contactPickList: Array<{
    id: string;
    name: string;
    email: string;
    department: string | null;
    rank: string | null;
    category: string | null;
    crmKind: CrmContactKind;
  }>;
  departments: string[];
  ranks: string[];
  categories: string[];
  presetCategories: string[];
  groups: Array<{ id: string; name: string; memberCount: number }>;
};

type StaffPolicyFormProps = {
  audience: InternalStaffAudience;
  onAudienceChange: (next: InternalStaffAudience) => void;
  directoryMeta: StaffPolicyDirectoryMeta | null;
  internalStaffCheckInMode?: InternalStaffCheckInMode;
  onInternalStaffCheckInModeChange?: (mode: InternalStaffCheckInMode) => void;
  /** When set with handler, shows Command Center walk-in toggle (internal staff wizard / edit). */
  allowFlashEntry?: boolean;
  onAllowFlashEntryChange?: (next: boolean) => void;
  noticeSettings?: InternalStaffNoticeSettings;
  onNoticeSettingsChange?: (next: InternalStaffNoticeSettings) => void;
  /** Used to tailor meeting-room helper copy (shown for all programme types). */
  eventType?: EventType;
};

const AUDIENCE_OPTIONS: Array<{ value: InternalStaffAudience["mode"]; label: string }> = [
  { value: "ENTIRE_ORG", label: "Entire organization (staff only)" },
  { value: "DEPARTMENTS", label: "Specific departments" },
  { value: "RANKS", label: "Specific rank / title" },
  { value: "EMPLOYMENT_STATUS", label: "Employment status (permanent / contract)" },
  { value: "CRM_KINDS", label: "Contact types (staff only by default)" },
  { value: "GROUPS", label: "CRM groups / segments" },
  { value: "MANUAL", label: "Manual selection (contacts)" }
];

const CRM_KIND_LABELS: Record<CrmContactKind, string> = {
  ATTENDEE: "Attendee / guest",
  EMPLOYEE: "Employee / internal",
  STAKEHOLDER: "Stakeholder",
  SPONSOR: "Sponsor",
  MEDIA_PRESS: "Media / press",
  VIP: "VIP",
  VENDOR: "Vendor",
  SPEAKER: "Speaker / faculty",
  OTHER: "Other"
};

function mergeCategoryOptions(meta: StaffPolicyDirectoryMeta | null): string[] {
  if (!meta) return [];
  const s = new Set<string>();
  for (const c of meta.presetCategories) s.add(c);
  for (const c of meta.categories) s.add(c);
  return [...s].sort((a, b) => a.localeCompare(b));
}

export function StaffPolicyForm({
  audience,
  onAudienceChange,
  directoryMeta,
  internalStaffCheckInMode,
  onInternalStaffCheckInModeChange,
  allowFlashEntry,
  onAllowFlashEntryChange,
  noticeSettings,
  onNoticeSettingsChange,
  eventType
}: StaffPolicyFormProps) {
  const categoryOptions = useMemo(() => mergeCategoryOptions(directoryMeta), [directoryMeta]);
  const [manualSearch, setManualSearch] = useState("");
  const [manualPage, setManualPage] = useState(1);

  const includeAllContactTypes = audience.includeAllContactTypes === true;

  const manualFilteredContacts = useMemo(() => {
    const all = directoryMeta?.contactPickList ?? [];
    const q = manualSearch.trim().toLowerCase();
    return all
      .filter((c) => (includeAllContactTypes ? true : c.crmKind === CrmContactKind.EMPLOYEE))
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.department ?? "").toLowerCase().includes(q) ||
          (c.rank ?? "").toLowerCase().includes(q)
        );
      });
  }, [directoryMeta?.contactPickList, includeAllContactTypes, manualSearch]);

  const manualPageCount = Math.max(1, Math.ceil(manualFilteredContacts.length / MANUAL_CONTACT_PAGE_SIZE));
  const safeManualPage = Math.min(manualPage, manualPageCount);
  const manualPageSlice = useMemo(() => {
    const start = (safeManualPage - 1) * MANUAL_CONTACT_PAGE_SIZE;
    return manualFilteredContacts.slice(start, start + MANUAL_CONTACT_PAGE_SIZE);
  }, [manualFilteredContacts, safeManualPage]);

  useEffect(() => {
    setManualPage(1);
  }, [manualSearch, includeAllContactTypes, audience.mode]);

  function setMode(mode: InternalStaffAudience["mode"]) {
    const includeAll = audience.includeAllContactTypes === true;
    switch (mode) {
      case "ENTIRE_ORG":
        onAudienceChange({ mode: "ENTIRE_ORG", excludeCategories: [], includeAllContactTypes: includeAll });
        break;
      case "DEPARTMENTS":
        onAudienceChange({
          mode: "DEPARTMENTS",
          departments: directoryMeta?.departments.slice(0, 1) ?? [],
          includeAllContactTypes: includeAll
        });
        break;
      case "RANKS":
        onAudienceChange({
          mode: "RANKS",
          ranks: directoryMeta?.ranks.slice(0, 1) ?? [],
          includeAllContactTypes: includeAll
        });
        break;
      case "EMPLOYMENT_STATUS":
        onAudienceChange({
          mode: "EMPLOYMENT_STATUS",
          employmentStatuses: [StaffEmploymentStatus.PERMANENT],
          includeAllContactTypes: includeAll
        });
        break;
      case "CRM_KINDS":
        onAudienceChange({
          mode: "CRM_KINDS",
          crmKinds: includeAll
            ? (Object.keys(CRM_KIND_LABELS) as CrmContactKind[])
            : [CrmContactKind.EMPLOYEE],
          includeAllContactTypes: includeAll
        });
        break;
      case "GROUPS":
        onAudienceChange({
          mode: "GROUPS",
          groupIds: directoryMeta?.groups.slice(0, 1).map((g) => g.id) ?? [],
          includeAllContactTypes: includeAll
        });
        break;
      case "MANUAL":
        onAudienceChange({ mode: "MANUAL", contactIds: [], includeAllContactTypes: includeAll });
        break;
      default:
        break;
    }
  }

  function toggleManualContact(id: string) {
    if (audience.mode !== "MANUAL") return;
    const has = audience.contactIds.includes(id);
    onAudienceChange({
      mode: "MANUAL",
      contactIds: has ? audience.contactIds.filter((x) => x !== id) : [...audience.contactIds, id],
      includeAllContactTypes
    });
  }

  return (
    <div className="space-y-8">
      {noticeSettings && onNoticeSettingsChange ? (
        <InternalStaffNoticeForm value={noticeSettings} onChange={onNoticeSettingsChange} eventType={eventType} />
      ) : null}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Select audience</h3>
        <p className="text-sm text-slate-600">
          Matching contacts are added to the guest list when the event is created. When you publish, each person
          receives a mandatory-attendance staff notice (email and SMS) with check-in instructions.
        </p>
        <label className="block text-sm font-medium text-slate-700">Audience</label>
        <select
          className="mt-1 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          value={audience.mode}
          onChange={(e) => setMode(e.target.value as InternalStaffAudience["mode"])}
        >
          {AUDIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="flex items-start gap-2 pt-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300"
            checked={includeAllContactTypes}
            onChange={(e) => {
              const next = e.target.checked;
              if (audience.mode === "CRM_KINDS") {
                const nextKinds = next ? (Object.keys(CRM_KIND_LABELS) as CrmContactKind[]) : [CrmContactKind.EMPLOYEE];
                onAudienceChange({ mode: "CRM_KINDS", crmKinds: nextKinds, includeAllContactTypes: next });
                return;
              }
              onAudienceChange({ ...audience, includeAllContactTypes: next } as InternalStaffAudience);
            }}
          />
          <span>
            Show all contact types (not only employee / internal).
            <span className="mt-0.5 block text-xs text-slate-500">
              Default is staff-only: employees/internal contacts only.
            </span>
          </span>
        </label>
      </div>

      {audience.mode === "ENTIRE_ORG" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Exclude categories (optional)</p>
          <p className="text-xs text-slate-500">Hold Ctrl/Cmd to select multiple.</p>
          <select
            multiple
            className="min-h-[120px] w-full max-w-md rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            value={audience.excludeCategories ?? []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              onAudienceChange({
                mode: "ENTIRE_ORG",
                excludeCategories: selected,
                includeAllContactTypes
              });
            }}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {categoryOptions.length === 0 ? (
            <p className="text-xs text-amber-800">
              No categories found yet — add CRM contacts first, or define category labels under Settings → CRM defaults.
            </p>
          ) : null}
        </div>
      ) : null}

      {audience.mode === "DEPARTMENTS" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Departments</p>
          <select
            multiple
            className="min-h-[140px] w-full max-w-md rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            value={audience.departments}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              onAudienceChange({
                mode: "DEPARTMENTS",
                departments: selected,
                includeAllContactTypes
              });
            }}
          >
            {(directoryMeta?.departments ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {(directoryMeta?.departments.length ?? 0) === 0 ? (
            <p className="text-xs text-amber-800">Add departments on CRM contact records first.</p>
          ) : null}
        </div>
      ) : null}

      {audience.mode === "RANKS" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Ranks / titles</p>
          <select
            multiple
            className="min-h-[140px] w-full max-w-md rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            value={audience.ranks}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              onAudienceChange({
                mode: "RANKS",
                ranks: selected,
                includeAllContactTypes
              });
            }}
          >
            {(directoryMeta?.ranks ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {(directoryMeta?.ranks.length ?? 0) === 0 ? (
            <p className="text-xs text-amber-800">Add rank values on contact records first.</p>
          ) : null}
        </div>
      ) : null}

      {audience.mode === "EMPLOYMENT_STATUS" ? (
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={audience.employmentStatuses.includes(StaffEmploymentStatus.PERMANENT)}
              onChange={(e) => {
                const next = new Set(audience.employmentStatuses);
                if (e.target.checked) next.add(StaffEmploymentStatus.PERMANENT);
                else next.delete(StaffEmploymentStatus.PERMANENT);
                onAudienceChange({
                  mode: "EMPLOYMENT_STATUS",
                  employmentStatuses: [...next],
                  includeAllContactTypes
                });
              }}
            />
            Permanent
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={audience.employmentStatuses.includes(StaffEmploymentStatus.CONTRACT)}
              onChange={(e) => {
                const next = new Set(audience.employmentStatuses);
                if (e.target.checked) next.add(StaffEmploymentStatus.CONTRACT);
                else next.delete(StaffEmploymentStatus.CONTRACT);
                onAudienceChange({
                  mode: "EMPLOYMENT_STATUS",
                  employmentStatuses: [...next],
                  includeAllContactTypes
                });
              }}
            />
            Contract
          </label>
        </div>
      ) : null}

      {audience.mode === "CRM_KINDS" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Contact types</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {(includeAllContactTypes ? (Object.keys(CRM_KIND_LABELS) as CrmContactKind[]) : [CrmContactKind.EMPLOYEE]).map((kind) => (
              <label key={kind} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={audience.crmKinds.includes(kind)}
                  onChange={(e) => {
                    const next = new Set(audience.crmKinds);
                    if (e.target.checked) next.add(kind);
                    else next.delete(kind);
                    if (next.size === 0) next.add(CrmContactKind.EMPLOYEE);
                    onAudienceChange({
                      mode: "CRM_KINDS",
                      crmKinds: [...next],
                      includeAllContactTypes
                    });
                  }}
                />
                {CRM_KIND_LABELS[kind]}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {audience.mode === "GROUPS" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">CRM groups / segments</p>
          <select
            multiple
            className="min-h-[140px] w-full max-w-md rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            value={audience.groupIds}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              onAudienceChange({
                mode: "GROUPS",
                groupIds: selected,
                includeAllContactTypes
              });
            }}
          >
            {(directoryMeta?.groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberCount})
              </option>
            ))}
          </select>
          {(directoryMeta?.groups.length ?? 0) === 0 ? (
            <p className="text-xs text-amber-800">Create CRM groups first on the CRM page.</p>
          ) : null}
        </div>
      ) : null}

      {audience.mode === "MANUAL" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">
            Pick staff contacts ({audience.contactIds.length} selected)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-700">Search</label>
              <Input
                className="mt-1"
                placeholder="Search by name, email, department, rank…"
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {includeAllContactTypes ? "Showing all contact types" : "Staff-only view"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50/80">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-white/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualFilteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-sm text-slate-600">
                      No contacts match your search.
                    </td>
                  </tr>
                ) : (
                  manualPageSlice.map((s) => (
                    <tr key={s.id} className="hover:bg-white">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={audience.contactIds.includes(s.id)}
                          onChange={() => toggleManualContact(s.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{s.name}</td>
                      <td className="px-3 py-2 text-slate-700">{s.email}</td>
                      <td className="px-3 py-2 text-slate-600">{s.department ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{s.rank ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {manualFilteredContacts.length > MANUAL_CONTACT_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Page {safeManualPage} of {manualPageCount} · {manualFilteredContacts.length} contact
                {manualFilteredContacts.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs"
                  disabled={safeManualPage <= 1}
                  onClick={() => setManualPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs"
                  disabled={safeManualPage >= manualPageCount}
                  onClick={() => setManualPage((p) => Math.min(manualPageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}

          {(directoryMeta?.contactPickList.length ?? 0) === 0 ? (
            <p className="text-xs text-amber-800">Import or add contacts in CRM first.</p>
          ) : null}
        </div>
      ) : null}

      {internalStaffCheckInMode !== undefined && onInternalStaffCheckInModeChange ? (
        <div className="space-y-3 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Self check-in policy</h3>
          <p className="text-sm text-slate-600">
            Personal links (recommended) include a unique URL in the staff notice and reduce proxy check-ins. Shared
            credential uses the public check-in page with staff ID or email.
          </p>
          <div className="space-y-2 text-sm">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
              <input
                type="radio"
                name="internal-checkin-mode"
                className="mt-1"
                checked={internalStaffCheckInMode === InternalStaffCheckInMode.SHARED_CREDENTIAL}
                onChange={() => onInternalStaffCheckInModeChange(InternalStaffCheckInMode.SHARED_CREDENTIAL)}
              />
              <span>
                <span className="font-medium text-slate-900">Shared staff ID / email on the check-in page</span>
                <span className="mt-1 block text-xs text-slate-600">
                  Anyone on the public link can check in with ID or email on file. You can still send personal links
                  from the event page as an extra option.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
              <input
                type="radio"
                name="internal-checkin-mode"
                className="mt-1"
                checked={internalStaffCheckInMode === InternalStaffCheckInMode.PERSONAL_LINK}
                onChange={() => onInternalStaffCheckInModeChange(InternalStaffCheckInMode.PERSONAL_LINK)}
              />
              <span>
                <span className="font-medium text-slate-900">Personal Zoom links (recommended)</span>
                <span className="mt-1 block text-xs text-slate-600">
                  Each staff member receives a unique link in the programme notice. The public check-in page still
                  accepts staff ID or email as a fallback.
                </span>
              </span>
            </label>
          </div>
        </div>
      ) : null}

      {allowFlashEntry !== undefined && onAllowFlashEntryChange ? (
        <div className="space-y-3 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Command Center walk-ins</h3>
          <p className="text-sm text-slate-600">
            The org lobby at <span className="font-mono text-xs font-medium text-slate-800">/o/your-org</span> lets
            people find published programs. Walk-ins can register on the spot when their email is not already a guest
            or CRM contact.
          </p>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={allowFlashEntry}
              onChange={(e) => onAllowFlashEntryChange(e.target.checked)}
            />
            <span>
              <span className="font-medium text-slate-900">Allow walk-ins from Command Center</span>
              <span className="mt-1 block text-xs text-slate-600">
                Turn off for strictly directory-driven internal programs (only invited CRM contacts and added guests).
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
