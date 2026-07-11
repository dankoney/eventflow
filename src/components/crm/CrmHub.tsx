"use client";

import { CrmContactKind, StaffEmploymentStatus } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown, ChevronDown, ChevronUp, CirclePlus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CrmImportWizard } from "@/components/crm/CrmImportWizard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import {
  assignSelectedContactsToGroup,
  createOrgContactGroup,
  deleteOrgContactGroup,
  setOrgContactGroupMembership,
  syncFilteredContactsToGroup,
  syncEventGuestsToCrm,
  syncGuestsIntoCrm
} from "@/lib/actions/crm.actions";
import {
  deleteOrgContactRow,
  deleteOrgContactRows,
  promoteOrgContactToWorkspaceUser,
  upsertOrgContactRow
} from "@/lib/actions/orgContact.actions";
import { orgContactUpsertFormSchema, type OrgContactUpsertFormValues } from "@/lib/crm/contactUpsertSchema";
import type { CrmHubContactRow, CrmHubSortField, OrgContactGroupListRow } from "@/lib/db/crm";
import { parseZoomAnonRosterName } from "@/lib/zoom/anonRosterName";
import { cn } from "@/lib/utils";

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

function tagsToStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 40);
}

function formatDateInput(d: Date | string | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function buildHref(base: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `/crm?${s}` : "/crm";
}

function SortableTh({
  label,
  field,
  sortBy,
  sortDir,
  baseQs
}: {
  label: string;
  field: CrmHubSortField;
  sortBy: string;
  sortDir: string;
  baseQs: Record<string, string | undefined>;
}) {
  const active = sortBy === field;
  const nextDir = active && sortDir === "asc" ? "desc" : "asc";
  const href = buildHref(baseQs, { sort: field, dir: nextDir, page: "1" });

  return (
    <th className="px-4 py-3 font-medium">
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 hover:text-slate-900",
          active ? "text-slate-900" : "text-slate-600"
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </Link>
    </th>
  );
}

type CrmHubProps = {
  rows: CrmHubContactRow[];
  total: number;
  page: number;
  pageSize: number;
  groups: OrgContactGroupListRow[];
  /** Events for event-scoped sync and filters (ISO date strings). */
  eventOptions: { id: string; name: string; date: string }[];
  filters: { q: string; crmKind: string; groupId: string; sortBy: string; sortDir: string };
  isAdmin: boolean;
  canDeleteContacts: boolean;
};

function formatEventPickLabel(name: string, dateIso: string) {
  try {
    const d = new Date(dateIso);
    const when = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
    return when ? `${name} · ${when}` : name;
  } catch {
    return name;
  }
}

export function CrmHub({
  rows,
  total,
  page,
  pageSize,
  groups,
  eventOptions,
  filters,
  isAdmin,
  canDeleteContacts
}: CrmHubProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CrmHubContactRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [crmImportOpen, setCrmImportOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState("");
  const [bulkEventFilterId, setBulkEventFilterId] = useState("");
  const [bulkGroupBusy, setBulkGroupBusy] = useState(false);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState("");
  const [selectedGroupBusy, setSelectedGroupBusy] = useState(false);
  const [eventSyncEventId, setEventSyncEventId] = useState("");
  const [eventSyncGroupId, setEventSyncGroupId] = useState("");
  const [eventSyncKind, setEventSyncKind] = useState<CrmContactKind>(CrmContactKind.ATTENDEE);
  const [eventSyncBusy, setEventSyncBusy] = useState(false);
  const [syncWizardOpen, setSyncWizardOpen] = useState(false);
  const [syncWizardMode, setSyncWizardMode] = useState<"all" | "event" | "filtered">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [bulkAction, setBulkAction] = useState<"edit_selected" | "delete_selected" | "invite_employee_user">(
    "edit_selected"
  );
  const selectAllRef = useRef<HTMLInputElement>(null);

  const baseQs = useMemo(
    () => ({
      q: filters.q || undefined,
      kind: filters.crmKind || undefined,
      group: filters.groupId || undefined,
      sort: filters.sortBy || undefined,
      dir: filters.sortDir || undefined,
      perPage: pageSize !== 25 ? String(pageSize) : undefined
    }),
    [filters, pageSize]
  );

  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPageSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = rowIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [allOnPageSelected, someOnPageSelected]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, filters.q, filters.crmKind, filters.groupId, filters.sortBy, filters.sortDir]);

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of rowIds) next.delete(id);
      } else {
        for (const id of rowIds) next.add(id);
      }
      return next;
    });
  }, [allOnPageSelected, rowIds]);

  const toggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const form = useForm<OrgContactUpsertFormValues>({
    resolver: zodResolver(orgContactUpsertFormSchema),
    defaultValues: {
      name: "",
      staffEmployeeId: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      department: "",
      hasWhatsapp: false,
      category: "",
      branch: "",
      employmentStatus: StaffEmploymentStatus.PERMANENT,
      dateJoined: new Date(),
      rank: "",
      crmKind: CrmContactKind.STAKEHOLDER,
      lifecycleStage: "",
      notes: "",
      tags: [],
      linkedinUrl: "",
      website: "",
      source: "manual",
      groupIds: []
    }
  });

  const openCreate = useCallback(() => {
    setEditing(null);
    setActionError(null);
    form.reset({
      name: "",
      staffEmployeeId: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      department: "",
      hasWhatsapp: false,
      category: "",
      branch: "",
      employmentStatus: StaffEmploymentStatus.PERMANENT,
      dateJoined: new Date(),
      rank: "",
      crmKind: CrmContactKind.STAKEHOLDER,
      lifecycleStage: "",
      notes: "",
      tags: [],
      linkedinUrl: "",
      website: "",
      source: "manual",
      groupIds: []
    });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (row: CrmHubContactRow) => {
      setEditing(row);
      setActionError(null);
      form.reset({
        id: row.id,
        name: row.name,
        staffEmployeeId: row.staffEmployeeId ?? "",
        email: row.email,
        phone: row.phone ?? "",
        company: row.company ?? "",
        jobTitle: row.jobTitle ?? "",
        department: row.department ?? "",
        hasWhatsapp: row.hasWhatsapp,
        category: row.category ?? "",
        branch: row.branch ?? "",
        employmentStatus: row.employmentStatus,
        dateJoined: new Date(row.dateJoined),
        rank: row.rank ?? "",
        crmKind: row.crmKind,
        lifecycleStage: row.lifecycleStage ?? "",
        notes: row.notes ?? "",
        tags: tagsToStrings(row.tags),
        linkedinUrl: row.linkedinUrl ?? "",
        website: row.website ?? "",
        source: row.source ?? "",
        groupIds: row.groups.map((g) => g.id)
      });
      setModalOpen(true);
    },
    [form]
  );

  async function onSubmit(values: OrgContactUpsertFormValues) {
    setActionError(null);
    const { groupIds, ...rest } = values;
    const res = await upsertOrgContactRow(rest);
    if (!res.success || !res.data) {
      setActionError(res.error ?? "Save failed");
      return;
    }
    const gRes = await setOrgContactGroupMembership({ contactId: res.data.id, groupIds: groupIds ?? [] });
    if (!gRes.success) {
      setActionError(gRes.error ?? "Saved contact but could not update groups.");
      return;
    }
    setModalOpen(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleteBusy(true);
    const res = await deleteOrgContactRow({ id: deleteId });
    setDeleteBusy(false);
    setDeleteId(null);
    if (!res.success) {
      setActionError(res.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  async function confirmBulkDelete() {
    if (selectedIds.size === 0 || !canDeleteContacts) return;
    setBulkDeleteBusy(true);
    const res = await deleteOrgContactRows({ ids: [...selectedIds] });
    setBulkDeleteBusy(false);
    setBulkDeleteOpen(false);
    if (!res.success) {
      setActionError(res.error ?? "Delete failed");
      return;
    }
    setSelectedIds(new Set());
    const n = res.data?.deleted;
    if (typeof n === "number" && n > 0) {
      setSyncResult(
        `Deleted ${n} record(s). Run “Sync from guests” to re-import from events if needed.`
      );
    }
    router.refresh();
  }

  async function onSyncGuests() {
    setSyncResult(null);
    setSyncBusy(true);
    const res = await syncGuestsIntoCrm();
    setSyncBusy(false);
    if (!res.success) {
      setSyncResult(res.error ?? "Sync failed");
      return;
    }
    const d = res.data;
    setSyncResult(
      `Synced ${d?.distinctEmails ?? 0} unique inviteable profiles — ${d?.guestsLinked ?? 0} guest rows linked. ` +
        `${d?.skippedNotInviteable ?? 0} guest row(s) skipped (need a valid work email and international mobile format, for example +14155552671; Zoom placeholder emails are excluded).` +
        (d && d.existingConflicts > 0
          ? ` ${d.existingConflicts} existing CRM contact(s) had differences and were not auto-overwritten.`
          : "")
    );
    router.refresh();
  }

  async function onSyncEventToCrm() {
    if (!eventSyncEventId) {
      setActionError("Choose an event to sync from.");
      return;
    }
    setActionError(null);
    setEventSyncBusy(true);
    const res = await syncEventGuestsToCrm({
      eventId: eventSyncEventId,
      groupId: eventSyncGroupId || undefined,
      crmKind: eventSyncKind
    });
    setEventSyncBusy(false);
    if (!res.success) {
      setActionError(res.error ?? "Event sync failed");
      return;
    }
    const d = res.data;
    setSyncResult(
      `Event sync: ${d?.processed ?? 0} guest(s) linked to CRM` +
        (d && d.skippedNoEmail > 0 ? `, ${d.skippedNoEmail} skipped (no / unusable email)` : "") +
        (d && d.skippedNoPhone > 0
          ? `, ${d.skippedNoPhone} skipped (no valid international mobile format, e.g. +14155552671)`
          : "") +
        (d && d.existingConflicts > 0
          ? `, ${d.existingConflicts} existing CRM contact(s) kept as-is (differences detected)`
          : "") +
        (eventSyncGroupId
          ? ` — group: +${d?.groupAdded ?? 0} added, ${d?.groupAlready ?? 0} already in group`
          : "")
    );
    router.refresh();
  }

  async function onCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    setGroupBusy(true);
    const res = await createOrgContactGroup({ name });
    setGroupBusy(false);
    if (!res.success) {
      setActionError(res.error ?? "Could not create group");
      return;
    }
    setNewGroupName("");
    router.refresh();
  }

  async function onSyncFilteredToGroup() {
    if (!bulkTargetGroupId) {
      setActionError("Choose a target group first.");
      return;
    }
    setActionError(null);
    setBulkGroupBusy(true);
    const res = await syncFilteredContactsToGroup({
      groupId: bulkTargetGroupId,
      q: filters.q || undefined,
      crmKind: (filters.crmKind as CrmContactKind) || undefined,
      sourceGroupId: filters.groupId || undefined,
      eventId: bulkEventFilterId || undefined
    });
    setBulkGroupBusy(false);
    if (!res.success) {
      setActionError(res.error ?? "Could not sync contacts to group.");
      return;
    }
    setSyncResult(
      `Group sync complete: ${res.data?.synced ?? 0} added, ${res.data?.alreadyInGroup ?? 0} already in group.`
    );
    router.refresh();
  }

  async function onAssignSelectedToGroup() {
    if (selectedIds.size === 0) return;
    setActionError(null);
    setSelectedGroupBusy(true);
    const res = await assignSelectedContactsToGroup({
      contactIds: [...selectedIds],
      groupId: selectedTargetGroupId || null
    });
    setSelectedGroupBusy(false);
    if (!res.success) {
      setActionError(res.error ?? "Could not update selected records.");
      return;
    }
    const n = res.data?.updated ?? 0;
    setSyncResult(
      selectedTargetGroupId
        ? `Selected contacts updated: ${n} added to the chosen group.`
        : `Selected contacts updated: ${n} group membership entries removed.`
    );
    setSelectedIds(new Set());
    router.refresh();
  }

  async function runBulkAction() {
    if (bulkAction === "delete_selected") {
      setBulkDeleteOpen(true);
      return;
    }
    if (bulkAction === "edit_selected") {
      if (selectedIds.size !== 1) {
        setActionError("Select exactly one contact to edit.");
        return;
      }
      const id = [...selectedIds][0];
      const row = rows.find((r) => r.id === id);
      if (!row) {
        setActionError("Selected contact is no longer available.");
        return;
      }
      openEdit(row);
      return;
    }

    const chosen = rows.filter((r) => selectedIds.has(r.id));
    const eligible = chosen.filter((r) => !r.userId && r.crmKind === CrmContactKind.EMPLOYEE);
    if (eligible.length === 0) {
      setActionError("No eligible employee/internal contacts selected for user invite.");
      return;
    }
    let invited = 0;
    const failures: string[] = [];
    for (const r of eligible) {
      const res = await promoteOrgContactToWorkspaceUser({ contactRowId: r.id });
      if (!res.success) failures.push(`${r.email}: ${res.error ?? "invite failed"}`);
      else invited += 1;
    }
    if (failures.length > 0) {
      setActionError(`Invited ${invited}. Issues: ${failures.slice(0, 3).join(" | ")}`);
    } else {
      setSyncResult(`Invited ${invited} employee user(s).`);
    }
    router.refresh();
  }

  async function runSyncWizard() {
    if (syncWizardMode === "all") {
      await onSyncGuests();
      setSyncWizardOpen(false);
      return;
    }
    if (syncWizardMode === "event") {
      await onSyncEventToCrm();
      if (!actionError) setSyncWizardOpen(false);
      return;
    }
    await onSyncFilteredToGroup();
    if (!actionError) setSyncWizardOpen(false);
  }

  const watchedGroupIds = form.watch("groupIds") ?? [];

  return (
    <div className="min-w-0 space-y-8">
      {actionError ? (
        <WorkspaceNotice variant="error" onDismiss={() => setActionError(null)}>
          {actionError}
        </WorkspaceNotice>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Groups &amp; segments</h3>
            <p className="mt-1 text-xs text-slate-600">Lists for campaigns, audiences, and reporting.</p>
          </div>
          <ul className="space-y-1 text-sm">
            <li>
              <Link
                href={buildHref(baseQs, { group: undefined })}
                className={cn(
                  "block rounded-md px-2 py-1.5",
                  !filters.groupId ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                )}
              >
                All contacts
              </Link>
            </li>
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-slate-50">
                <Link
                  href={buildHref(baseQs, { group: g.id })}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-md px-2 py-1.5",
                    filters.groupId === g.id ? "bg-slate-900 text-white" : "text-slate-700"
                  )}
                >
                  <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: g.color ?? "#94a3b8" }} />
                  {g.name}
                  <span className="ml-1 text-xs opacity-80">({g.memberCount})</span>
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-2 py-1 text-xs text-rose-800"
                  onClick={() => void deleteOrgContactGroup({ id: g.id }).then((r) => (r.success ? router.refresh() : setActionError(r.error ?? "Delete failed")))}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              className="text-sm"
              placeholder="New group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-900 bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              title="Add group"
              aria-label="Add group"
              disabled={groupBusy}
              onClick={() => void onCreateGroup()}
            >
              <CirclePlus className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="flex flex-1 flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const q = String(fd.get("q") ?? "").trim();
                router.push(buildHref(baseQs, { q, page: "1" }));
              }}
            >
              <Input name="q" defaultValue={filters.q} placeholder="Search name, email, company…" className="max-w-md flex-1 text-sm" />
              <Button type="submit" variant="secondary" className="h-10 px-4 text-sm">
                Search
              </Button>
            </form>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              value={filters.crmKind}
              onChange={(e) => router.push(buildHref(baseQs, { kind: e.target.value || undefined, page: "1" }))}
            >
              <option value="">All types</option>
              {(Object.keys(CRM_KIND_LABELS) as CrmContactKind[]).map((k) => (
                <option key={k} value={k}>
                  {CRM_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <Button type="button" className="h-10 px-4 text-sm" onClick={openCreate}>
              New record
            </Button>
            <Button type="button" variant="secondary" className="h-10 px-4 text-sm" onClick={() => setCrmImportOpen(true)}>
              Import
            </Button>
            <Button type="button" variant="secondary" className="h-10 px-4 text-sm" onClick={() => setSyncWizardOpen(true)}>
              <RefreshCw className="mr-2 inline h-4 w-4" />
              Sync wizard
            </Button>
          </div>
          {syncResult ? <p className="text-xs text-slate-700">{syncResult}</p> : null}

          {selectedIds.size > 0 ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
              <div className="font-medium">
                {selectedIds.size} selected
                {someOnPageSelected && rowIds.length ? ` · ${rowIds.filter((id) => selectedIds.has(id)).length} on this page` : ""}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-amber-200/80 pt-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">Grouping</label>
                <select
                  className="h-9 rounded-md border border-amber-300 bg-white px-2 text-sm text-slate-900"
                  value={selectedTargetGroupId}
                  onChange={(e) => setSelectedTargetGroupId(e.target.value)}
                  disabled={selectedGroupBusy}
                >
                  <option value="">Ungroup selected</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                  disabled={selectedGroupBusy}
                  onClick={() => void onAssignSelectedToGroup()}
                >
                  {selectedGroupBusy ? "Applying…" : "Apply group"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-amber-200/80 pt-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">Action</label>
                <select
                  className="h-9 rounded-md border border-amber-300 bg-white px-2 text-sm text-slate-900"
                  value={bulkAction}
                  onChange={(e) =>
                    setBulkAction(e.target.value as "edit_selected" | "delete_selected" | "invite_employee_user")
                  }
                >
                  <option value="edit_selected">Edit</option>
                  <option value="delete_selected">Delete</option>
                  <option value="invite_employee_user">Invite employee</option>
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                  disabled={bulkAction === "delete_selected" && !canDeleteContacts}
                  onClick={() => void runBulkAction()}
                >
                  Run action
                </Button>
                <span className="text-xs text-amber-900/80">
                  Use &quot;Sync from guests&quot; after deleting to refresh roster from events.
                </span>
              </div>
            </div>
          ) : null}

          <div className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="w-full min-w-0 max-h-[30rem] overflow-auto overscroll-x-contain pb-1">
              <table className="w-full min-w-[1500px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {canDeleteContacts ? (
                      <th className="w-10 px-2 py-3">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                          aria-label="Select all on this page"
                        />
                      </th>
                    ) : null}
                    <SortableTh label="Name" field="name" sortBy={filters.sortBy} sortDir={filters.sortDir} baseQs={baseQs} />
                    <th className="px-4 py-3 font-medium">Anonymous</th>
                    <SortableTh label="Type" field="crmKind" sortBy={filters.sortBy} sortDir={filters.sortDir} baseQs={baseQs} />
                    <SortableTh label="Email" field="email" sortBy={filters.sortBy} sortDir={filters.sortDir} baseQs={baseQs} />
                    <SortableTh label="Company" field="company" sortBy={filters.sortBy} sortDir={filters.sortDir} baseQs={baseQs} />
                    <SortableTh label="Stage" field="lifecycleStage" sortBy={filters.sortBy} sortDir={filters.sortDir} baseQs={baseQs} />
                    <th className="px-4 py-3 font-medium">Groups</th>
                    <th className="px-4 py-3 font-medium">Guests</th>
                    <SortableTh label="Source" field="source" sortBy={filters.sortBy} sortDir={filters.sortDir} baseQs={baseQs} />
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={canDeleteContacts ? 12 : 11} className="px-4 py-8 text-center text-slate-600">
                        No records match these filters. Import CSV, add a contact, or sync attendees from events.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const { isAnonymous, displayName } = parseZoomAnonRosterName(r.name, r.email);
                      return (
                        <tr key={r.id} className="border-t border-slate-100">
                          {canDeleteContacts ? (
                            <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300"
                                checked={selectedIds.has(r.id)}
                                onChange={() => toggleSelectRow(r.id)}
                                aria-label={`Select ${displayName}`}
                              />
                            </td>
                          ) : null}
                          <td className="max-w-[280px] px-4 py-2 font-medium text-slate-900">
                            <span className="line-clamp-2" title={displayName}>
                              {displayName}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                            {isAnonymous ? (
                              <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800">
                                Yes
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-700">{CRM_KIND_LABELS[r.crmKind]}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.email}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.company ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.lifecycleStage ?? "—"}</td>
                          <td className="max-w-[200px] px-4 py-2 text-xs text-slate-600">
                            {r.groups.length ? (
                              <span className="line-clamp-2">
                                {r.groups.map((g) => (
                                  <Fragment key={g.id}>
                                    <span className="mr-1 inline-block rounded-full bg-slate-100 px-2 py-0.5">{g.name}</span>
                                  </Fragment>
                                ))}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.guestCount}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.source ?? "—"}</td>
                          <td className="max-w-[360px] px-4 py-2 text-slate-600">
                            <span className="line-clamp-2">{r.notes?.trim() || "—"}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {total > 0 ? (
              <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="whitespace-nowrap text-xs sm:text-sm">
                    Page {page} of {pageCount} · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <span className="text-slate-500">Rows per page</span>
                    <select
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs sm:text-sm"
                      value={pageSize}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10) || 25;
                        router.push(buildHref(baseQs, { perPage: n === 25 ? undefined : String(n), page: "1" }));
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  {page <= 1 ? (
                    <span className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-400">Previous</span>
                  ) : (
                    <Link
                      href={buildHref(baseQs, { page: String(page - 1) })}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50"
                      scroll={false}
                    >
                      Previous
                    </Link>
                  )}
                  {page >= pageCount ? (
                    <span className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-400">Next</span>
                  ) : (
                    <Link
                      href={buildHref(baseQs, { page: String(page + 1) })}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50"
                      scroll={false}
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            ) : null}
          </div>

        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit CRM record" : "New CRM record"}>
        <form className="max-h-[80vh] space-y-3 overflow-y-auto pr-1" onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Full name</label>
              <Input className="mt-1" {...form.register("name")} />
            </div>
            <div>
              <label className="text-xs font-medium">Type</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" {...form.register("crmKind")}>
                {(Object.keys(CRM_KIND_LABELS) as CrmContactKind[]).map((k) => (
                  <option key={k} value={k}>
                    {CRM_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Sync-from-guests defaults to attendee. You can override this anytime.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium">Lifecycle stage</label>
              <Input className="mt-1" placeholder="e.g. prospect, active" {...form.register("lifecycleStage")} />
            </div>
            <div>
              <label className="text-xs font-medium">Email</label>
              <Input className="mt-1" type="email" {...form.register("email")} disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs font-medium">Phone (international, e.g. +14155552671)</label>
              <Input className="mt-1" {...form.register("phone")} />
            </div>
            <div>
              <label className="text-xs font-medium">Company</label>
              <Input className="mt-1" {...form.register("company")} />
            </div>
            <div>
              <label className="text-xs font-medium">Job title</label>
              <Input className="mt-1" {...form.register("jobTitle")} />
            </div>
            <div>
              <label className="text-xs font-medium">External / badge ID</label>
              <Input className="mt-1" {...form.register("staffEmployeeId")} />
            </div>
            <div>
              <label className="text-xs font-medium">Department</label>
              <Input className="mt-1" {...form.register("department")} />
            </div>
            <div>
              <label className="text-xs font-medium">Branch</label>
              <Input className="mt-1" {...form.register("branch")} />
            </div>
            <div>
              <label className="text-xs font-medium">Category</label>
              <Input className="mt-1" {...form.register("category")} />
            </div>
            <div>
              <label className="text-xs font-medium">Rank / title line</label>
              <Input className="mt-1" {...form.register("rank")} />
            </div>
            <div>
              <label className="text-xs font-medium">Employment</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" {...form.register("employmentStatus")}>
                <option value={StaffEmploymentStatus.PERMANENT}>Permanent</option>
                <option value={StaffEmploymentStatus.CONTRACT}>Contract</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Relationship since</label>
              <Input
                className="mt-1"
                type="date"
                value={formatDateInput(form.watch("dateJoined"))}
                onChange={(e) => form.setValue("dateJoined", new Date(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Tags (comma-separated)</label>
              <Input
                className="mt-1"
                value={(form.watch("tags") ?? []).join(", ")}
                onChange={(e) =>
                  form.setValue(
                    "tags",
                    e.target.value
                      .split(/[,;]/g)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 40)
                  )
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Notes</label>
              <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-slate-300 px-2 py-2 text-sm" {...form.register("notes")} />
            </div>
            <div>
              <label className="text-xs font-medium">LinkedIn URL</label>
              <Input className="mt-1" {...form.register("linkedinUrl")} />
            </div>
            <div>
              <label className="text-xs font-medium">Website</label>
              <Input className="mt-1" {...form.register("website")} />
            </div>
            <div>
              <label className="text-xs font-medium">Source</label>
              <Input className="mt-1" {...form.register("source")} placeholder="manual, import_csv, …" />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.watch("hasWhatsapp")}
                onChange={(e) => form.setValue("hasWhatsapp", e.target.checked)}
              />
              WhatsApp on file for this number
            </label>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-800">Groups</p>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
              {groups.length === 0 ? (
                <p className="text-xs text-slate-500">Create a group in the sidebar first.</p>
              ) : (
                groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={watchedGroupIds.includes(g.id)}
                      onChange={(e) => {
                        const next = new Set(watchedGroupIds);
                        if (e.target.checked) next.add(g.id);
                        else next.delete(g.id);
                        form.setValue("groupIds", [...next]);
                      }}
                    />
                    {g.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete CRM record?"
        message="Removes this person from the CRM. Linked guest rows keep their snapshot but lose the canonical link."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={deleteBusy}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.size} CRM record(s)?`}
        message="Removes these people from the CRM. Linked guest rows keep their snapshots but lose the canonical link. Use Sync from guests to pull attendees again if needed."
        confirmLabel="Delete selected"
        cancelLabel="Cancel"
        variant="danger"
        busy={bulkDeleteBusy}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
      />

      <CrmImportWizard
        open={crmImportOpen}
        onOpenChange={setCrmImportOpen}
        onImported={() => router.refresh()}
      />

      <Modal
        open={syncWizardOpen}
        onClose={() => setSyncWizardOpen(false)}
        title="Sync contacts to CRM"
        subtitle="Choose one flow, review what it does, set required inputs, then run."
        size="xl"
        headerTone="dark"
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setSyncWizardMode("all")}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs font-medium",
                syncWizardMode === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
              )}
            >
              <span className="block text-[11px] uppercase tracking-wide opacity-80">Option 1</span>
              <span className="mt-1 block text-sm font-semibold">Sync all inviteable guests</span>
              <span className="mt-1 block text-[11px] opacity-80">Use this for a full CRM refresh from all events.</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncWizardMode("event")}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs font-medium",
                syncWizardMode === "event" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
              )}
            >
              <span className="block text-[11px] uppercase tracking-wide opacity-80">Option 2</span>
              <span className="mt-1 block text-sm font-semibold">Sync one event</span>
              <span className="mt-1 block text-[11px] opacity-80">Set type/group for contacts from a specific event.</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncWizardMode("filtered")}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs font-medium",
                syncWizardMode === "filtered" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
              )}
            >
              <span className="block text-[11px] uppercase tracking-wide opacity-80">Option 3</span>
              <span className="mt-1 block text-sm font-semibold">Add filtered contacts to group</span>
              <span className="mt-1 block text-[11px] opacity-80">Applies current CRM filters to group assignment.</span>
            </button>
          </div>

          {syncWizardMode === "all" ? (
            <p className="text-sm text-slate-600">
              Sync all inviteable guest profiles into CRM and link guest rows to contacts.
            </p>
          ) : null}

          {syncWizardMode === "event" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex min-w-0 flex-col gap-1 text-xs">
                <span className="font-medium text-slate-700">Event</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={eventSyncEventId}
                  onChange={(e) => setEventSyncEventId(e.target.value)}
                >
                  <option value="">Select event…</option>
                  {eventOptions.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatEventPickLabel(e.name, e.date)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-700">CRM type</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={eventSyncKind}
                  onChange={(e) => setEventSyncKind(e.target.value as CrmContactKind)}
                >
                  {(Object.keys(CRM_KIND_LABELS) as CrmContactKind[]).map((k) => (
                    <option key={k} value={k}>
                      {CRM_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-700">Group (optional)</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={eventSyncGroupId}
                  onChange={(e) => setEventSyncGroupId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {syncWizardMode === "filtered" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-700">Filter by event (optional)</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={bulkEventFilterId}
                  onChange={(e) => setBulkEventFilterId(e.target.value)}
                >
                  <option value="">All events (no guest filter)</option>
                  {eventOptions.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatEventPickLabel(e.name, e.date)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-700">Target group</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={bulkTargetGroupId}
                  onChange={(e) => setBulkTargetGroupId(e.target.value)}
                >
                  <option value="">Select target group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={() => setSyncWizardOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                syncBusy ||
                eventSyncBusy ||
                bulkGroupBusy ||
                (syncWizardMode === "event" && !eventSyncEventId) ||
                (syncWizardMode === "filtered" && !bulkTargetGroupId)
              }
              onClick={() => void runSyncWizard()}
            >
              {syncBusy || eventSyncBusy || bulkGroupBusy ? "Running…" : "Run sync"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
