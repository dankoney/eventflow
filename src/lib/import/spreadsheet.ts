import * as XLSX from "xlsx";

import { parseCsv } from "@/lib/csv";

function normalizeTableCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export async function parseSpreadsheetFile(file: File): Promise<string[][]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: ""
    });
    return rows.map((row) => row.map((cell) => normalizeTableCell(cell)));
  }

  const text = await file.text();
  return parseCsv(text);
}

