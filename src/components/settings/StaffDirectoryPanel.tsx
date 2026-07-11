"use client";

import { Fragment } from "react";
import { StaffEmploymentStatus } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import {
  deleteOrgContactRow,
  importOrgContactsFromCsv,
  promoteOrgContactToWorkspaceUser,
  updateOrgContactDirectoryMeta,
  upsertOrgContactRow
} from "@/lib/actions/orgContact.actions";
import { rowsToCsv } from "@/lib/csv";
import type { OrgContactListRow } from "@/lib/db/orgContact";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";

const staffFormSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(2).max(120),
    staffEmployeeId: z.string().max(80).optional().nullable(),
    email: z.string().email(),
    department: z.string().max(120).optional().nullable(),
    phone: z.string().min(1, "Mobile phone is required"),
  hasWhatsapp: z.boolean(),
  category: z.string().max(80).optional().nullable(),
  branch: z.string().max(120).optional().nullable(),
    employmentStatus: z.nativeEnum(StaffEmploymentStatus),
    dateJoined: z.string().min(1),
    rank: z.string().max(120).optional().nullable()
  })
  .superRefine((data, ctx) => {
    if (!isValidE164(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid international mobile number, for example +14155552671.",
        path: ["phone"]
      });
    }
  });

type StaffFormValues = z.infer<typeof staffFormSchema>;

const metaSchema = z.object({
  categoryLabelsCsv: z.string().max(4000),
  internalStaffFooterContact: z.string().max(240).optional().nullable()
});

const COL_STORAGE_KEY = "eventflow_contact_dir_cols_v1";

type DataColId =
  | "name"
  | "staffEmployeeId"
  | "email"
  | "department"
  | "phone"
  | "hasWhatsapp"
  | "category"
  | "branch"
  | "employmentStatus"
  | "dateJoined"
  | "rank";

const DATA_COL_DEFS: { id: DataColId; label: string; defaultOn: boolean }[] = [
  { id: "name", label: "Name", defaultOn: true },
  { id: "staffEmployeeId", label: "Employee ID", defaultOn: true },
  { id: "email", label: "Email", defaultOn: true },
  { id: "department", label: "Department", defaultOn: true },
  { id: "phone", label: "Phone", defaultOn: true },
  { id: "hasWhatsapp", label: "WhatsApp", defaultOn: false },
  { id: "category", label: "Category", defaultOn: false },
  { id: "branch", label: "Branch", defaultOn: false },
  { id: "employmentStatus", label: "Status", defaultOn: false },
  { id: "dateJoined", label: "Joined", defaultOn: false },
  { id: "rank", label: "Rank", defaultOn: false }
];

const DEFAULT_VISIBLE = new Set(
  DATA_COL_DEFS.filter((c) => c.defaultOn).map((c) => c.id) as DataColId[]
);

function parseStoredCols(raw: string | null): Set<DataColId> {
  if (!raw) return new Set(DEFAULT_VISIBLE);
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return new Set(DEFAULT_VISIBLE);
    const allowed = new Set(DATA_COL_DEFS.map((c) => c.id));
    const next = new Set<DataColId>();
    for (const x of v) {
      if (typeof x === "string" && allowed.has(x as DataColId)) next.add(x as DataColId);
    }
    if (!next.has("name")) next.add("name");
    if (next.size === 0) return new Set(DEFAULT_VISIBLE);
    return next;
  } catch {
    return new Set(DEFAULT_VISIBLE);
  }
}

type StaffDirectoryPanelProps = {
  rows: OrgContactListRow[];
  staffPage: number;
  staffPageSize: number;
  staffTotal: number;
  isAdmin: boolean;
  defaultCategoryLabelsCsv: string;
  defaultFooterContact: string | null;
};

function statusLabel(s: StaffEmploymentStatus) {
  return s === StaffEmploymentStatus.PERMANENT ? "Permanent" : "Contract";
}

function staffSettingsHref(page: number) {
  return `/dashboard/settings?tab=contacts&contactsPage=${page}`;
}

function downloadStaffImportTemplate() {
  const headers = [
    "name",
    "staffEmployeeId",
    "email",
    "department",
    "phone",
    "hasWhatsapp",
    "category",
    "branch",
    "employmentStatus",
    "dateJoined",
    "rank"
  ];
  const sample = [
    "Jane Example",
    "EMP-1001",
    "jane.example@yourcompany.com",
    "Operations",
    "+233201234567",
    "false",
    "HQ",
    "Accra",
    "PERMANENT",
    "2026-01-15",
    "Supervisor"
  ];
  const csv = "\uFEFF" + rowsToCsv(headers, [sample]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eventflow-contacts-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function renderDataCell(col: DataColId, r: OrgContactListRow) {
  switch (col) {
    case "name":
      return <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-900">{r.name}</td>;
    case "staffEmployeeId":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.staffEmployeeId ?? "—"}</td>;
    case "email":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.email}</td>;
    case "department":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.department ?? "—"}</td>;
    case "phone":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.phone ?? "—"}</td>;
    case "hasWhatsapp":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.hasWhatsapp ? "Yes" : "—"}</td>;
    case "category":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.category ?? "—"}</td>;
    case "branch":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.branch ?? "—"}</td>;
    case "employmentStatus":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{statusLabel(r.employmentStatus)}</td>;
    case "dateJoined":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-600">{new Date(r.dateJoined).toLocaleDateString()}</td>;
    case "rank":
      return <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.rank ?? "—"}</td>;
    default:
      return null;
  }
}

export function ContactsDirectoryPanel({
  rows,
  staffPage,
  staffPageSize,
  staffTotal,
  isAdmin,
  defaultCategoryLabelsCsv,
  defaultFooterContact
}: StaffDirectoryPanelProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrgContactListRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);
  const [deleteStaffBusy, setDeleteStaffBusy] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<Set<DataColId>>(() => new Set(DEFAULT_VISIBLE));

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisibleCols(parseStoredCols(window.localStorage.getItem(COL_STORAGE_KEY)));
  }, []);

  const persistCols = useCallback((next: Set<DataColId>) => {
    const withName = new Set(next);
    withName.add("name");
    setVisibleCols(withName);
    try {
      window.localStorage.setItem(COL_STORAGE_KEY, JSON.stringify([...withName]));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCol = useCallback(
    (id: DataColId) => {
      if (id === "name") return;
      const next = new Set(visibleCols);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistCols(next);
    },
    [visibleCols, persistCols]
  );

  const orderedVisible = useMemo(
    () => DATA_COL_DEFS.map((c) => c.id).filter((id) => visibleCols.has(id)),
    [visibleCols]
  );

  const pageCount = Math.max(1, Math.ceil(staffTotal / staffPageSize));

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      name: "",
      staffEmployeeId: "",
      email: "",
      department: "",
      phone: "",
      hasWhatsapp: false,
      category: "",
      branch: "",
      employmentStatus: StaffEmploymentStatus.PERMANENT,
      dateJoined: new Date().toISOString().slice(0, 10),
      rank: ""
    }
  });

  const metaForm = useForm<z.infer<typeof metaSchema>>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      categoryLabelsCsv: defaultCategoryLabelsCsv,
      internalStaffFooterContact: defaultFooterContact ?? ""
    }
  });

  function openCreate() {
    setEditing(null);
    setActionError(null);
    form.reset({
      name: "",
      staffEmployeeId: "",
      email: "",
      department: "",
      phone: "",
      hasWhatsapp: false,
      category: "",
      branch: "",
      employmentStatus: StaffEmploymentStatus.PERMANENT,
      dateJoined: new Date().toISOString().slice(0, 10),
      rank: ""
    });
    setModalOpen(true);
  }

  function openEdit(row: OrgContactListRow) {
    setEditing(row);
    setActionError(null);
    form.reset({
      id: row.id,
      name: row.name,
      staffEmployeeId: row.staffEmployeeId ?? "",
      email: row.email,
      department: row.department ?? "",
      phone: row.phone ?? "",
      hasWhatsapp: row.hasWhatsapp,
      category: row.category ?? "",
      branch: row.branch ?? "",
      employmentStatus: row.employmentStatus,
      dateJoined: new Date(row.dateJoined).toISOString().slice(0, 10),
      rank: row.rank ?? ""
    });
    setModalOpen(true);
  }

  async function onSave(values: StaffFormValues) {
    setActionError(null);
    const res = await upsertOrgContactRow({
      id: values.id,
      name: values.name,
      staffEmployeeId: values.staffEmployeeId || null,
      email: values.email,
      department: values.department || null,
      phone: values.phone.trim(),
      hasWhatsapp: values.hasWhatsapp,
      category: values.category || null,
      branch: values.branch || null,
      employmentStatus: values.employmentStatus,
      dateJoined: new Date(values.dateJoined),
      rank: values.rank || null
    });
    if (!res.success) {
      setActionError(res.error ?? "Save failed");
      return;
    }
    setModalOpen(false);
    router.refresh();
  }

  function requestDeleteStaff(id: string) {
    setActionError(null);
    setDeleteStaffId(id);
  }

  async function confirmDeleteStaff() {
    if (!deleteStaffId) return;
    setDeleteStaffBusy(true);
    const res = await deleteOrgContactRow({ id: deleteStaffId });
    setDeleteStaffBusy(false);
    setDeleteStaffId(null);
    if (!res.success) {
      setActionError(res.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  async function onPromote(id: string) {
    setActionError(null);
    const res = await promoteOrgContactToWorkspaceUser({ contactRowId: id });
    if (!res.success) {
      setActionError(res.error ?? "Could not add user");
      return;
    }
    router.refresh();
  }

  async function onImportCsv() {
    setCsvResult(null);
    setCsvBusy(true);
    const res = await importOrgContactsFromCsv({ csvText });
    setCsvBusy(false);
    if (!res.success) {
      setCsvResult(res.error ?? "Import failed");
      return;
    }
    setCsvResult(
      `Imported ${res.data?.imported ?? 0} (${res.data?.created ?? 0} new, ${res.data?.updated ?? 0} updated), skipped ${res.data?.skipped ?? 0}.`
    );
    if (res.data?.errors?.length) {
      setCsvResult((prev) => `${prev ?? ""} ${res.data?.errors?.join(" ")}`);
    }
    setCsvText("");
    router.refresh();
  }

  async function onSaveMeta(values: z.infer<typeof metaSchema>) {
    setActionError(null);
    const res = await updateOrgContactDirectoryMeta(values);
    if (!res.success) {
      setActionError(res.error ?? "Could not save settings");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Contact directory defaults</h3>
        <p className="mt-1 text-xs text-slate-600">
          These settings apply to your <strong>whole organization</strong>, not a single event.{' '}
          <strong>Category labels</strong> become preset options when you filter contacts in the internal staff event
          wizard (for example, excluding a category from an audience).{' '}
          <strong>Internal registration footer contact</strong> is a short line shown at the bottom of the public
          staff check-in page (for example, “Contact HR” or a department name) so people know who to reach if they are
          missing from the list.
        </p>
        <form className="mt-4 space-y-3" onSubmit={metaForm.handleSubmit((v) => void onSaveMeta(v))}>
          <div>
            <label className="text-xs font-medium text-slate-700">Category labels (comma or newline)</label>
            <textarea
              className="mt-1 w-full min-h-[72px] rounded-md border border-slate-300 px-2 py-2 text-sm"
              {...metaForm.register("categoryLabelsCsv")}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Internal registration footer contact line</label>
            <Input className="mt-1" placeholder='e.g. "MIS Department"' {...metaForm.register("internalStaffFooterContact")} />
          </div>
          <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
            Save directory settings
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Contacts</h3>
          <p className="text-xs text-slate-600">Separate from workspace users. Promote to user when someone needs dashboard access.</p>
        </div>
        <Button type="button" className="px-3 py-1.5 text-xs" onClick={openCreate}>
          Add contact
        </Button>
      </div>

      {actionError ? (
        <WorkspaceNotice variant="error" onDismiss={() => setActionError(null)}>
          {actionError}
        </WorkspaceNotice>
      ) : null}

      <div className="space-y-2 rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-800">CSV import</p>
        <p className="text-xs text-slate-600">
          Header row with columns: name, staffEmployeeId, email, phone (international, e.g. +14155552671), department, hasWhatsapp, category, branch,
          employmentStatus (PERMANENT or CONTRACT), dateJoined (ISO), rank.
        </p>
        <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={downloadStaffImportTemplate}>
          Download CSV template
        </Button>
        <textarea
          className="mt-2 w-full min-h-[120px] rounded-md border border-slate-300 px-2 py-2 font-mono text-xs"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Paste CSV…"
        />
        <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" disabled={csvBusy} onClick={() => void onImportCsv()}>
          {csvBusy ? "Importing…" : "Import CSV"}
        </Button>
        {csvResult ? <p className="text-xs text-slate-700">{csvResult}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <details className="relative text-sm">
          <summary className="cursor-pointer list-none rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-800 hover:bg-slate-50">
            Table columns
          </summary>
          <div className="absolute left-0 z-20 mt-1 min-w-[220px] rounded-md border border-slate-200 bg-white p-3 shadow-lg">
            <p className="text-xs text-slate-500">Shown on this browser. Name is always visible.</p>
            <ul className="mt-2 space-y-2">
              {DATA_COL_DEFS.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.id)}
                      disabled={c.id === "name"}
                      onChange={() => toggleCol(c.id)}
                    />
                    {c.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </details>
        <p className="text-xs text-slate-600">
          Showing {staffTotal === 0 ? 0 : (staffPage - 1) * staffPageSize + 1}–
          {Math.min(staffPage * staffPageSize, staffTotal)} of {staffTotal}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">No contacts yet — add a row or import a CSV.</p>
        ) : (
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {orderedVisible.map((col) => (
                  <th key={col} className="whitespace-nowrap px-4 py-3 font-medium">
                    {DATA_COL_DEFS.find((d) => d.id === col)?.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  {orderedVisible.map((col) => (
                    <Fragment key={`${r.id}-${col}`}>{renderDataCell(col, r)}</Fragment>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => requestDeleteStaff(r.id)}>
                        Delete
                      </Button>
                      {isAdmin && !r.userId ? (
                        <Button type="button" className="px-3 py-1.5 text-xs" onClick={() => void onPromote(r.id)}>
                          Add to users
                        </Button>
                      ) : null}
                      {r.userId ? <span className="text-xs text-slate-500">Has user</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {staffTotal > staffPageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">
            Page {staffPage} of {pageCount}
          </span>
          <div className="flex gap-2">
            {staffPage <= 1 ? (
              <span className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-400">Previous</span>
            ) : (
              <Link
                href={staffSettingsHref(staffPage - 1)}
                scroll={false}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                Previous
              </Link>
            )}
            {staffPage >= pageCount ? (
              <span className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-400">Next</span>
            ) : (
              <Link
                href={staffSettingsHref(staffPage + 1)}
                scroll={false}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit contact" : "Add contact"}>
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => void onSave(v))}>
          {actionError ? (
            <WorkspaceNotice variant="error" onDismiss={() => setActionError(null)}>
              {actionError}
            </WorkspaceNotice>
          ) : null}
          <div>
            <label className="text-xs font-medium">Name</label>
            <Input className="mt-1" {...form.register("name")} />
          </div>
          <div>
            <label className="text-xs font-medium">Employee ID</label>
            <Input className="mt-1" {...form.register("staffEmployeeId")} placeholder="Optional" />
          </div>
          <div>
            <label className="text-xs font-medium">Email</label>
            <Input className="mt-1" type="email" {...form.register("email")} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Department</label>
              <Input className="mt-1" {...form.register("department")} />
            </div>
            <div>
              <label className="text-xs font-medium">Phone</label>
              <Input className="mt-1" {...form.register("phone")} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.watch("hasWhatsapp")}
              onChange={(e) => form.setValue("hasWhatsapp", e.target.checked)}
            />
            Has WhatsApp on this number
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Category</label>
              <Input className="mt-1" {...form.register("category")} />
            </div>
            <div>
              <label className="text-xs font-medium">Branch</label>
              <Input className="mt-1" {...form.register("branch")} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Employment</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" {...form.register("employmentStatus")}>
                <option value={StaffEmploymentStatus.PERMANENT}>Permanent</option>
                <option value={StaffEmploymentStatus.CONTRACT}>Contract</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Date joined</label>
              <Input className="mt-1" type="date" {...form.register("dateJoined")} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Rank</label>
            <Input className="mt-1" {...form.register("rank")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteStaffId}
        title="Delete contact?"
        message="Delete this contact from the directory? This cannot be undone."
        confirmLabel="Delete record"
        cancelLabel="Cancel"
        variant="danger"
        busy={deleteStaffBusy}
        onCancel={() => setDeleteStaffId(null)}
        onConfirm={() => void confirmDeleteStaff()}
      />
    </div>
  );
}

/** @deprecated Use `ContactsDirectoryPanel` */
export const StaffDirectoryPanel = ContactsDirectoryPanel;
