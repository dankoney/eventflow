"use client";

import { AttendMode, Role, Tier } from "@prisma/client";
import { Download, Search, Upload, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { GuestDetailDrawer } from "@/components/guests/GuestDetailDrawer";
import { GuestForm } from "@/components/guests/GuestForm";
import { GuestStatusBadge } from "@/components/guests/GuestStatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { importGuestsFromRows } from "@/lib/actions/guest.actions";
import type { GuestWithRep } from "@/lib/db/guests";
import { parseCsv, rowsToCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { GuestStatus } from "@/types";

type SalesRepOption = { id: string; name: string | null; email: string };

const IMPORT_HEADER_MAP: Record<string, keyof CsvRow> = {
  name: "name",
  "full name": "name",
  email: "email",
  "work email": "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  company: "company",
  "job title": "jobTitle",
  title: "jobTitle",
  tier: "tier",
  mode: "mode",
  dietary: "dietary",
  "rep email": "repEmail",
  "sales rep": "repEmail"
};

type CsvRow = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  tier?: string;
  mode?: string;
  dietary?: string;
  repEmail?: string;
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

type GuestManagementPanelProps = {
  eventId: string;
  guests: GuestWithRep[];
  salesReps: SalesRepOption[];
  role: Role;
  currentUserId: string;
};

export function GuestManagementPanel({
  eventId,
  guests,
  salesReps,
  role,
  currentUserId
}: GuestManagementPanelProps) {
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"ALL" | AttendMode>("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | Tier>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<CsvRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [selected, setSelected] = useState<GuestWithRep | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (modeFilter !== "ALL" && g.mode !== modeFilter) return false;
      if (tierFilter !== "ALL" && g.tier !== tierFilter) return false;
      if (!q) return true;
      const hay = [g.name, g.email, g.phone ?? "", g.company ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [guests, search, modeFilter, tierFilter]);

  function exportCsv() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Job Title",
      "Tier",
      "Mode",
      "Status",
      "Rep",
      "Dietary"
    ];
    const rows = filtered.map((g) => [
      g.name,
      g.email,
      g.phone ?? "",
      g.company ?? "",
      g.jobTitle ?? "",
      g.tier,
      g.mode,
      g.status,
      g.repName ?? g.repEmail ?? "",
      g.dietary ?? ""
    ]);
    const csv = "\uFEFF" + rowsToCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guests-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    setImportError(null);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const table = parseCsv(text);
        if (table.length < 2) {
          setParseError("CSV must include a header row and at least one data row.");
          setImportPreview(null);
          return;
        }
        const headerCells = table[0].map((c) => normalizeHeader(c));
        const mappedKeys = headerCells.map((h) => IMPORT_HEADER_MAP[h] ?? null);
        const out: CsvRow[] = [];
        for (let r = 1; r < table.length; r++) {
          const cells = table[r];
          const row: Record<string, string> = {};
          mappedKeys.forEach((key, i) => {
            if (!key) return;
            row[key] = cells[i]?.trim() ?? "";
          });
          if (row.name?.trim() && row.email?.trim()) {
            out.push({
              name: row.name.trim(),
              email: row.email.trim(),
              phone: row.phone,
              company: row.company,
              jobTitle: row.jobTitle,
              tier: row.tier,
              mode: row.mode,
              dietary: row.dietary,
              repEmail: row.repEmail
            });
          }
        }
        if (out.length === 0) {
          setParseError("No valid rows found. Map columns to Name and Email (see supported headers in code or use those exact titles).");
          setImportPreview(null);
          return;
        }
        setImportPreview(out);
      } catch {
        setParseError("Could not parse CSV file.");
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!importPreview?.length) return;
    setImportLoading(true);
    setImportError(null);
    const res = await importGuestsFromRows(
      eventId,
      importPreview.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone ?? "",
        company: r.company ?? "",
        jobTitle: r.jobTitle ?? "",
        tier: r.tier ?? "C",
        mode: r.mode ?? "in_person",
        dietary: r.dietary ?? "",
        repEmail: r.repEmail ?? ""
      }))
    );
    setImportLoading(false);
    if (!res.success) {
      setImportError(res.error ?? "Import failed");
      return;
    }
    setImportPreview(null);
    if (res.error) {
      window.alert(res.error);
    }
    window.location.reload();
  }

  function afterAdd() {
    setAddOpen(false);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      {parseError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {parseError}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, email, phone, company…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
          >
            <option value="ALL">Mode: All</option>
            <option value={AttendMode.IN_PERSON}>In person</option>
            <option value={AttendMode.VIRTUAL}>Virtual</option>
          </select>
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
          >
            <option value="ALL">Tier: All</option>
            <option value={Tier.A}>A</option>
            <option value={Tier.B}>B</option>
            <option value={Tier.C}>C</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setAddOpen(true)}>
          <UserPlus className="mr-2 inline h-4 w-4" />
          Add guest
        </Button>
        <Button type="button" variant="secondary" onClick={exportCsv}>
          <Download className="mr-2 inline h-4 w-4" />
          Export CSV
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <Table
        headers={["Name", "Phone", "Company", "Mode", "Tier", "Status", "Rep", "Actions"]}
      >
        {filtered.map((g) => (
          <tr
            key={g.id}
            className={cn("cursor-pointer border-t border-slate-100 hover:bg-slate-50")}
            onClick={() => setSelected(g)}
          >
            <td className="px-4 py-2 font-medium text-slate-900">{g.name}</td>
            <td className="px-4 py-2 text-slate-700">{g.phone ?? "—"}</td>
            <td className="px-4 py-2 text-slate-700">{g.company ?? "—"}</td>
            <td className="px-4 py-2">{g.mode === AttendMode.VIRTUAL ? "Virtual" : "In person"}</td>
            <td className="px-4 py-2">{g.tier}</td>
            <td className="px-4 py-2">
              <GuestStatusBadge status={g.status as GuestStatus} />
            </td>
            <td className="px-4 py-2 text-slate-700">{g.repName ?? g.repEmail ?? "—"}</td>
            <td className="px-4 py-2">
              <button
                type="button"
                className="text-sky-700 underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(g);
                }}
              >
                View
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No guests match your filters.</p>
      ) : null}

      <Modal open={addOpen} title="Add guest" onClose={() => setAddOpen(false)}>
        <GuestForm
          eventId={eventId}
          salesReps={salesReps}
          role={role}
          currentUserId={currentUserId}
          onSuccess={afterAdd}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>

      <Modal
        open={!!importPreview}
        title="Confirm import"
        onClose={() => setImportPreview(null)}
      >
        {importPreview ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {importPreview.length} row(s) will be imported. Existing emails on this event will be skipped as
              errors.
            </p>
            <div className="max-h-56 overflow-auto rounded border border-slate-100 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Email</th>
                    <th className="px-2 py-1 text-left">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1">{r.email}</td>
                      <td className="px-2 py-1">{r.mode || "in_person"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importError ? <p className="text-sm text-red-600">{importError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setImportPreview(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={importLoading} onClick={confirmImport}>
                {importLoading ? "Importing…" : "Confirm import"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <GuestDetailDrawer guest={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
