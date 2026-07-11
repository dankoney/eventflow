"use client";

import { CloudDownload, FileEdit, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { importGuestsFromRows } from "@/lib/actions/guest.actions";
import {
  CSV_IMPORT_MAP_OPTIONS,
  type CsvRow,
  buildRowsFromTable,
  defaultColumnMappingFromHeaders,
  hasNameAndEmailMapping,
  hasRequiredImportMapping,
  parseManualGuestLines,
  sampleImportTemplate
} from "@/lib/guests/csvImport";
import { parseSpreadsheetFile } from "@/lib/import/spreadsheet";
import { cn } from "@/lib/utils";

type GuestImportWizardProps = {
  eventId: string;
  open: boolean;
  emailMandatoryForRegistration?: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

const PREVIEW_COLUMNS: Array<{ key: keyof CsvRow; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "countryCode", label: "Country code" },
  { key: "company", label: "Company" },
  { key: "jobTitle", label: "Job title" },
  { key: "tier", label: "Tier" },
  { key: "mode", label: "Mode" },
  { key: "dietary", label: "Dietary" },
  { key: "country", label: "Country" },
  { key: "accessibilityNotes", label: "Accessibility" },
  { key: "referralSource", label: "Referral source" },
  { key: "staffEmployeeId", label: "Staff ID" },
  { key: "department", label: "Department" },
  { key: "branch", label: "Branch" },
  { key: "repEmail", label: "Rep email" }
];

const STEPS = [
  { id: 1, label: "Import method" },
  { id: 2, label: "Upload data" },
  { id: 3, label: "Map attributes" },
  { id: 4, label: "Import progress" }
] as const;

export function GuestImportWizard({
  eventId,
  open,
  emailMandatoryForRegistration = true,
  onOpenChange,
  onImported
}: GuestImportWizardProps) {
  const [method, setMethod] = useState<"file" | "manual" | null>(null);
  /** 1–4 for file path; manual skips 3 */
  const [step, setStep] = useState(1);
  const [rawTable, setRawTable] = useState<string[][] | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<number, keyof CsvRow | "ignore">>({});
  const [manualText, setManualText] = useState("");
  const [previewRows, setPreviewRows] = useState<CsvRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importDoneMessage, setImportDoneMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMethod(null);
    setStep(1);
    setRawTable(null);
    setColumnMapping({});
    setManualText("");
    setPreviewRows(null);
    setParseError(null);
    setImportError(null);
    setImportLoading(false);
    setImportDoneMessage(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [onOpenChange, reset]);

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + sampleImportTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guest-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFileChosen(file: File) {
    setParseError(null);
    try {
      const table = await parseSpreadsheetFile(file);
      if (table.length < 2) {
        setParseError("The file needs a header row and at least one data row.");
        setRawTable(null);
        return;
      }
      setRawTable(table);
      setColumnMapping(defaultColumnMappingFromHeaders(table[0]!.map((c) => String(c ?? ""))));
      setStep(3);
    } catch {
      setParseError("Could not read that file. Use CSV or Excel (.xlsx/.xls).");
      setRawTable(null);
    }
  }

  function continueFromManual() {
    setParseError(null);
    const rows = parseManualGuestLines(manualText, { emailRequired: emailMandatoryForRegistration });
    if (rows.length === 0) {
      setParseError(
        emailMandatoryForRegistration
          ? "Add at least one line with name, email, and phone (for example +14155552671, or 4155552671 with countryCode 1)."
          : "Add at least one line with name and phone (for example +14155552671, or 4155552671 with countryCode 1)."
      );
      return;
    }
    setPreviewRows(rows);
    setStep(4);
  }

  function continueFromMap() {
    if (!rawTable) return;
    setParseError(null);
    if (!hasRequiredImportMapping(columnMapping, emailMandatoryForRegistration)) {
      setParseError(
        emailMandatoryForRegistration
          ? 'Map at least one column to "Full name" and one to "Email".'
          : 'Map at least one column to "Full name" and one to "Phone".'
      );
      return;
    }
    const rows = buildRowsFromTable(rawTable, columnMapping, {
      emailRequired: emailMandatoryForRegistration
    });
    if (rows.length === 0) {
      setParseError(
        emailMandatoryForRegistration
          ? "No valid rows: every line needs a name and email."
          : "No valid rows: every line needs a name and phone."
      );
      return;
    }
    setPreviewRows(rows);
    setStep(4);
  }

  async function runImport() {
    if (!previewRows?.length) return;
    setImportLoading(true);
    setImportError(null);
    const rowCount = previewRows.length;
    const res = await importGuestsFromRows(
      eventId,
      previewRows.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone ?? "",
        countryCode: r.countryCode ?? "",
        company: r.company ?? "",
        jobTitle: r.jobTitle ?? "",
        tier: r.tier ?? "C",
        mode: r.mode ?? "",
        dietary: r.dietary ?? "",
        country: r.country ?? "",
        accessibilityNotes: r.accessibilityNotes ?? "",
        referralSource: r.referralSource ?? "",
        staffEmployeeId: r.staffEmployeeId ?? "",
        department: r.department ?? "",
        branch: r.branch ?? "",
        repEmail: r.repEmail ?? ""
      }))
    );
    setImportLoading(false);
    if (!res.success) {
      setImportError(res.error ?? "Import failed");
      return;
    }
    const extra = res.error ? ` ${res.error}` : "";
    setImportDoneMessage(`Processed ${rowCount} row(s).${extra}`);
    onImported();
  }

  function stepVisualState(
    sid: number
  ): "pending" | "active" | "done" | "skip" {
    if (!method) return step === sid ? "active" : "pending";
    if (method === "manual") {
      if (sid === 3) {
        if (step >= 4) return "skip";
        return "pending";
      }
      if (step === 4) {
        if (sid === 4) return "active";
        if (sid < 3) return "done";
        return "pending";
      }
    }
    if (step === sid) return "active";
    if (step > sid) return "done";
    return "pending";
  }

  const title =
    step === 1
      ? "Choose a data source"
      : step === 2
        ? method === "manual"
          ? "Enter guests"
          : "Upload a file"
        : step === 3
          ? "Map columns"
          : "Review and import";

  const subtitle =
    step === 4
      ? "Confirm the first rows, then import. Duplicate email or phone values on this event are skipped."
      : step === 3
        ? "Match each column to a guest field. Name and email are required."
        : undefined;

  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={handleClose}
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
            Registrant import template
            <span aria-hidden>↗</span>
          </button>
          <div className="flex flex-wrap gap-1">
            {STEPS.map((s) => {
              const vs = stepVisualState(s.id);
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    vs === "active"
                      ? "border-zinc-700 bg-zinc-50 text-zinc-900"
                      : vs === "done"
                        ? "border-zinc-200 bg-white text-zinc-900"
                        : vs === "skip"
                          ? "border-zinc-200 border-dashed bg-zinc-50 text-zinc-400"
                          : "border-zinc-200 text-zinc-400"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                      vs === "active"
                        ? "bg-zinc-700 text-white"
                        : vs === "done"
                          ? "bg-zinc-500 text-white"
                          : vs === "skip"
                            ? "bg-zinc-200 text-zinc-500"
                            : "bg-zinc-200 text-zinc-600"
                    )}
                  >
                    {vs === "skip" ? "—" : s.id}
                  </span>
                  {s.label}
                </div>
              );
            })}
          </div>
        </div>

        {parseError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{parseError}</p>
        ) : null}

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
              <CloudDownload className="h-12 w-12 text-zinc-700" aria-hidden />
              <span className="text-base font-bold text-zinc-900">Import from file</span>
              <span className="text-xs text-zinc-500">CSV with a header row</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("manual");
                setStep(2);
              }}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-zinc-200 bg-white p-8 text-center shadow-sm transition hover:border-zinc-400 hover:shadow-md"
            >
              <FileEdit className="h-12 w-12 text-zinc-700" aria-hidden />
              <span className="text-base font-bold text-zinc-900">Import manually</span>
              <span className="text-xs text-zinc-500">Paste or type one guest per line</span>
            </button>
          </div>
        ) : null}

        {step === 2 && method === "file" ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 transition hover:border-zinc-400 hover:bg-zinc-50/40">
              <Upload className="h-10 w-10 text-zinc-700" />
              <span className="text-sm font-semibold text-zinc-900">Drop CSV/Excel file or click to browse</span>
              <span className="text-xs text-zinc-500">CSV, XLSX, XLS · first row = column headers</span>
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
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="border-zinc-200" onClick={() => setStep(1)}>
                Back
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 && method === "manual" ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              One guest per line as comma-separated values. Required:
              <span className="font-medium text-zinc-800"> name, email, phone</span>.
            </p>
            <textarea
              className="min-h-[200px] w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner outline-none transition focus:border-zinc-700 focus:ring-2 focus:ring-zinc-700/20"
              placeholder={
                "Jane Doe,jane@company.com,5551234567,1,Acme,Director,B\nJohn Smith,john@company.com,+14155552671,,Acme,Director,B"
              }
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="border-zinc-200" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" className="bg-zinc-900 font-semibold text-white hover:bg-zinc-800" onClick={continueFromManual}>
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
                          value={columnMapping[colIdx] ?? "ignore"}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({
                              ...prev,
                              [colIdx]: e.target.value as keyof CsvRow | "ignore"
                            }))
                          }
                        >
                          <option value="ignore">Ignore</option>
                          {CSV_IMPORT_MAP_OPTIONS.map((opt) => (
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
            <p className="text-xs text-zinc-500">
              Preview:{" "}
              {
                buildRowsFromTable(rawTable, columnMapping, {
                  emailRequired: emailMandatoryForRegistration
                }).length
              }{" "}
              valid row(s) detected.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="border-zinc-200" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" className="bg-zinc-900 font-semibold text-white hover:bg-zinc-800" onClick={continueFromMap}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 && previewRows ? (
          <div className="space-y-4">
            {importDoneMessage ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">{importDoneMessage}</p>
            ) : (
              <>
                <p className="text-sm text-zinc-600">
                  <span className="font-semibold text-zinc-900">{previewRows.length}</span> row(s) ready to import.
                </p>
                <div className="max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50/80 text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-white text-left text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                        {PREVIEW_COLUMNS.map((c) => (
                          <th key={c.key} className="whitespace-nowrap px-3 py-2">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {previewRows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="bg-white">
                          {PREVIEW_COLUMNS.map((c) => {
                            const raw = r[c.key];
                            const value = raw?.trim() ? raw : "—";
                            return (
                              <td
                                key={`${i}-${c.key}`}
                                className={cn(
                                  "whitespace-nowrap px-3 py-2 text-zinc-700",
                                  c.key === "name" ? "font-medium text-zinc-900" : ""
                                )}
                              >
                                {value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importError ? <p className="text-sm text-red-600">{importError}</p> : null}
              </>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-between sm:gap-3">
              <Button
                type="button"
                variant="secondary"
                className="border-zinc-200 sm:w-auto"
                onClick={() => {
                  if (importDoneMessage) {
                    handleClose();
                    return;
                  }
                  if (method === "file") {
                    setStep(3);
                  } else {
                    setStep(2);
                  }
                }}
              >
                {importDoneMessage ? "Close" : "Back"}
              </Button>
              {!importDoneMessage ? (
                <Button
                  type="button"
                  className="bg-zinc-900 font-semibold text-white hover:bg-zinc-800 sm:w-auto"
                  disabled={importLoading}
                  onClick={() => void runImport()}
                >
                  {importLoading ? "Importing…" : "Run import"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex border-t border-zinc-100 pt-4">
            <button type="button" onClick={handleClose} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
