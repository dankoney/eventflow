"use client";

import { CloudDownload, FileEdit, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CrmImportIssuesTable } from "@/components/crm/CrmImportIssuesTable";
import { importOrgContactsFromCsv } from "@/lib/actions/orgContact.actions";
import { parseCsv } from "@/lib/csv";
import { rowsToCsv } from "@/lib/csv";
import { parseSpreadsheetFile } from "@/lib/import/spreadsheet";
import type { CrmImportIssue } from "@/types/crmImport";
import { cn } from "@/lib/utils";

type CrmImportWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

type CrmCsvField =
  | "name"
  | "email"
  | "phone"
  | "countryCode"
  | "crmKind"
  | "company"
  | "jobTitle"
  | "staffEmployeeId"
  | "department"
  | "lifecycleStage"
  | "tags"
  | "notes"
  | "linkedinUrl"
  | "website"
  | "source"
  | "hasWhatsapp"
  | "category"
  | "branch"
  | "employmentStatus"
  | "dateJoined"
  | "rank";

type CrmRow = Partial<Record<CrmCsvField, string>>;

const MAP_OPTIONS: Array<{ value: CrmCsvField; label: string }> = [
  { value: "name", label: "Full name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "countryCode", label: "Country code (e.g. 1, 233)" },
  { value: "crmKind", label: "CRM type" },
  { value: "company", label: "Company" },
  { value: "jobTitle", label: "Job title" },
  { value: "staffEmployeeId", label: "Staff / badge ID" },
  { value: "department", label: "Department" },
  { value: "lifecycleStage", label: "Lifecycle stage" },
  { value: "tags", label: "Tags (semicolon list)" },
  { value: "notes", label: "Notes" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
  { value: "website", label: "Website" },
  { value: "source", label: "Source" },
  { value: "hasWhatsapp", label: "Has WhatsApp (true/false)" },
  { value: "category", label: "Category" },
  { value: "branch", label: "Branch" },
  { value: "employmentStatus", label: "Employment status" },
  { value: "dateJoined", label: "Date joined (YYYY-MM-DD)" },
  { value: "rank", label: "Rank" }
];

const STEPS = [
  { id: 1, label: "Import method" },
  { id: 2, label: "Upload data" },
  { id: 3, label: "Map attributes" },
  { id: 4, label: "Import progress" }
] as const;

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

const HEADER_MAP: Record<string, CrmCsvField> = {
  name: "name",
  "full name": "name",
  email: "email",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  "country code": "countryCode",
  countrycode: "countryCode",
  dialcode: "countryCode",
  "dial code": "countryCode",
  crmkind: "crmKind",
  "crm kind": "crmKind",
  "crm type": "crmKind",
  company: "company",
  "job title": "jobTitle",
  jobtitle: "jobTitle",
  "staff id": "staffEmployeeId",
  "employee id": "staffEmployeeId",
  staffemployeeid: "staffEmployeeId",
  department: "department",
  "lifecycle stage": "lifecycleStage",
  lifecyclestage: "lifecycleStage",
  tags: "tags",
  notes: "notes",
  linkedinurl: "linkedinUrl",
  website: "website",
  source: "source",
  haswhatsapp: "hasWhatsapp",
  category: "category",
  branch: "branch",
  employmentstatus: "employmentStatus",
  "employment status": "employmentStatus",
  datejoined: "dateJoined",
  "date joined": "dateJoined",
  rank: "rank"
};

function defaultMapping(headers: string[]): Record<number, CrmCsvField | "ignore"> {
  const out: Record<number, CrmCsvField | "ignore"> = {};
  headers.forEach((h, i) => {
    out[i] = HEADER_MAP[normalizeHeader(h)] ?? "ignore";
  });
  return out;
}

function buildRows(table: string[][], mapping: Record<number, CrmCsvField | "ignore">): CrmRow[] {
  if (table.length < 2) return [];
  const out: CrmRow[] = [];
  for (let r = 1; r < table.length; r++) {
    const row: CrmRow = {};
    const cells = table[r] ?? [];
    for (const [colStr, key] of Object.entries(mapping)) {
      if (key === "ignore") continue;
      const col = parseInt(colStr, 10);
      if (Number.isNaN(col)) continue;
      const v = cells[col]?.trim() ?? "";
      if (v) row[key] = v;
    }
    if (row.name?.trim() && row.email?.trim() && row.phone?.trim()) out.push(row);
  }
  return out;
}

function sampleTemplateCsv() {
  const headers = [
    "name",
    "email",
    "countryCode",
    "phone",
    "crmKind",
    "company",
    "jobTitle",
    "staffEmployeeId",
    "department",
    "lifecycleStage",
    "tags",
    "notes",
    "linkedinUrl",
    "website",
    "source",
    "hasWhatsapp",
    "category",
    "branch",
    "employmentStatus",
    "dateJoined",
    "rank"
  ];
  const sample = [
    "Alex Rivera",
    "alex@example.com",
    "1",
    "5551234567",
    "STAKEHOLDER",
    "Acme Corp",
    "Head of partnerships",
    "EXT-9001",
    "Revenue",
    "engaged",
    "board;priority",
    "Met at flagship summit",
    "https://www.linkedin.com/in/example",
    "https://example.com",
    "import_csv",
    "false",
    "Strategic",
    "NYC",
    "PERMANENT",
    "2026-01-10",
    "Director"
  ];
  return rowsToCsv(headers, [sample]);
}

export function CrmImportWizard({ open, onOpenChange, onImported }: CrmImportWizardProps) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<"file" | "manual" | null>(null);
  const [rawTable, setRawTable] = useState<string[][] | null>(null);
  const [manualCsv, setManualCsv] = useState("");
  const [mapping, setMapping] = useState<Record<number, CrmCsvField | "ignore">>({});
  const [previewRows, setPreviewRows] = useState<CrmRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotes, setImportNotes] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<CrmImportIssue[]>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setMethod(null);
    setRawTable(null);
    setManualCsv("");
    setMapping({});
    setPreviewRows(null);
    setParseError(null);
    setImportError(null);
    setImportNotes(null);
    setImportIssues([]);
    setUpdateExisting(true);
    setBusy(false);
    setDoneMsg(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [onOpenChange, reset]);

  async function onFileChosen(file: File) {
    setParseError(null);
    try {
      const table = await parseSpreadsheetFile(file);
      if (table.length < 2) {
        setParseError("File needs a header row and at least one data row.");
        return;
      }
      setRawTable(table);
      setMapping(defaultMapping(table[0]!.map((c) => String(c ?? ""))));
      setStep(3);
    } catch {
      setParseError("Could not parse this file. Use CSV or Excel (.xlsx/.xls).");
    }
  }

  function continueManual() {
    setParseError(null);
    try {
      const table = parseCsv(manualCsv);
      if (table.length < 2) {
        setParseError("CSV needs a header row and at least one data row.");
        return;
      }
      setRawTable(table);
      setMapping(defaultMapping(table[0]!.map((c) => String(c ?? ""))));
      setStep(3);
    } catch {
      setParseError("Could not parse manual CSV text.");
    }
  }

  function continueMap() {
    if (!rawTable) return;
    const rows = buildRows(rawTable, mapping);
    if (rows.length === 0) {
      setParseError("No valid rows. Required per row: name, email, phone.");
      return;
    }
    setPreviewRows(rows);
    setStep(4);
  }

  const previewCsv = useMemo(() => {
    if (!previewRows?.length) return "";
    const headers = MAP_OPTIONS.map((m) => m.value);
    const rows = previewRows.map((r) => headers.map((h) => r[h] ?? ""));
    return rowsToCsv(headers, rows);
  }, [previewRows]);

  async function runImport() {
    if (!previewRows?.length) return;
    setBusy(true);
    setImportError(null);
    setImportNotes(null);
    setImportIssues([]);
    const res = await importOrgContactsFromCsv({ csvText: previewCsv, updateExisting });
    setBusy(false);
    if (!res.success) {
      setImportError(res.error ?? "Import failed");
      return;
    }
    const created = res.data?.created ?? 0;
    const updated = res.data?.updated ?? 0;
    const skipped = res.data?.skipped ?? 0;
    const saved = res.data?.imported ?? 0;
    const detail =
      created || updated
        ? ` (${created ? `${created} new` : ""}${created && updated ? ", " : ""}${updated ? `${updated} updated` : ""})`
        : "";
    const text = `Imported ${saved} contact${saved === 1 ? "" : "s"}${detail}, skipped ${skipped}.`;
    setDoneMsg(text);
    const issues = res.data?.issues ?? [];
    setImportIssues(issues);
    if (res.data?.errors?.length) {
      setImportNotes(res.data.errors.slice(0, 5).join(" | "));
    } else if (issues.length === 0 && (res.data?.skipped ?? 0) > 0) {
      setImportNotes("Some rows were skipped due to validation. Review the messages below.");
    }
    onImported();
  }

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + sampleTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eventflow-crm-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === 4 ? "Review and import CRM contacts" : "Import CRM contacts"}
      subtitle={
        step === 4
          ? "Confirm rows, then run import. Required fields: name, email, phone."
          : "Use CSV file or paste CSV text. Map columns before import."
      }
      size="xl"
      headerTone="dark"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-800 underline-offset-2 hover:underline"
          >
            CRM import template
            <span aria-hidden>↗</span>
          </button>
          <div className="flex flex-wrap gap-1">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  step === s.id
                    ? "border-zinc-700 bg-zinc-50 text-zinc-900"
                    : step > s.id
                      ? "border-zinc-200 bg-white text-zinc-900"
                      : "border-zinc-200 text-zinc-400"
                )}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {parseError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{parseError}</p> : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMethod("file");
                setStep(2);
              }}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-zinc-200 bg-white p-8 text-center shadow-sm transition hover:border-zinc-400 hover:shadow-md"
            >
              <CloudDownload className="h-12 w-12 text-zinc-700" />
              <span className="text-base font-bold text-zinc-900">Import from file</span>
              <span className="text-xs text-zinc-500">CSV with header row</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("manual");
                setStep(2);
              }}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-zinc-200 bg-white p-8 text-center shadow-sm transition hover:border-zinc-400 hover:shadow-md"
            >
              <FileEdit className="h-12 w-12 text-zinc-700" />
              <span className="text-base font-bold text-zinc-900">Paste CSV</span>
              <span className="text-xs text-zinc-500">Manual CSV input</span>
            </button>
          </div>
        ) : null}

        {step === 2 && method === "file" ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 transition hover:border-zinc-400">
              <Upload className="h-10 w-10 text-zinc-700" />
              <span className="text-sm font-semibold text-zinc-900">Drop CSV/Excel file or click to browse</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFileChosen(f);
                  e.target.value = "";
                }}
              />
            </label>
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
          </div>
        ) : null}

        {step === 2 && method === "manual" ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">Paste CSV text including header row.</p>
            <textarea
              className="min-h-[220px] w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-inner outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-zinc-700/20"
              value={manualCsv}
              onChange={(e) => setManualCsv(e.target.value)}
              placeholder={"name,email,phone,crmKind\nAlex,alex@example.com,+1555...,STAKEHOLDER"}
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" onClick={continueManual}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 && rawTable ? (
          <div className="space-y-4">
            <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-100 text-zinc-600">
                  <tr>
                    {rawTable[0]!.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-2 py-2 font-semibold">
                        {h || `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-white">
                    {rawTable[0]!.map((_, colIdx) => (
                      <td key={colIdx} className="border-t border-zinc-100 px-2 py-2 align-top">
                        <select
                          className="w-full min-w-[220px] rounded-md border border-zinc-300 bg-white py-1 text-xs font-medium text-zinc-900"
                          value={mapping[colIdx] ?? "ignore"}
                          onChange={(e) =>
                            setMapping((prev) => ({ ...prev, [colIdx]: e.target.value as CrmCsvField | "ignore" }))
                          }
                        >
                          <option value="ignore">Ignore</option>
                          {MAP_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
            <p className="text-xs text-zinc-500">Preview: {buildRows(rawTable, mapping).length} valid row(s).</p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" onClick={continueMap}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 && previewRows ? (
          <div className="space-y-4">
            {doneMsg ? (
              <div className="space-y-3">
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">{doneMsg}</p>
                {importIssues.length > 0 ? <CrmImportIssuesTable issues={importIssues} /> : null}
                {importNotes ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{importNotes}</p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="text-sm text-zinc-600">
                  <span className="font-semibold text-zinc-900">{previewRows.length}</span> row(s) ready to import.
                </p>
                <div className="max-h-56 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50/80 text-xs">
                  <table className="w-full">
                    <thead className="border-b border-zinc-200 bg-white text-left text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      <tr>
                        {MAP_OPTIONS.map((c) => (
                          <th key={c.value} className="whitespace-nowrap px-3 py-2">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {previewRows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="bg-white">
                          {MAP_OPTIONS.map((c) => (
                            <td
                              key={`${i}-${c.value}`}
                              className={cn("whitespace-nowrap px-3 py-2 text-zinc-700", c.value === "name" ? "font-medium text-zinc-900" : "")}
                            >
                              {(r[c.value] ?? "").trim() || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-zinc-900">Update existing contacts</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      When email or phone matches someone already in CRM, overwrite their profile with the CSV row
                      (company, title, notes, etc.). Uncheck to skip those rows instead.
                    </span>
                  </span>
                </label>
                {importError ? <p className="text-sm text-red-600">{importError}</p> : null}
              </>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (doneMsg) {
                    close();
                    return;
                  }
                  setStep(3);
                }}
              >
                {doneMsg ? "Close" : "Back"}
              </Button>
              {!doneMsg ? (
                <Button type="button" disabled={busy} onClick={() => void runImport()}>
                  {busy ? "Importing…" : "Run import"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

