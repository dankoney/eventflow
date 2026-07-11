/**
 * Shared CSV / bulk guest import row shape and column mapping.
 */

export type CsvRow = {
  name: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  company?: string;
  jobTitle?: string;
  tier?: string;
  mode?: string;
  dietary?: string;
  country?: string;
  accessibilityNotes?: string;
  referralSource?: string;
  staffEmployeeId?: string;
  department?: string;
  branch?: string;
  repEmail?: string;
};

export const IMPORT_HEADER_MAP: Record<string, keyof CsvRow> = {
  name: "name",
  "full name": "name",
  email: "email",
  "work email": "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  "country code": "countryCode",
  countrycode: "countryCode",
  dialcode: "countryCode",
  "dial code": "countryCode",
  company: "company",
  "job title": "jobTitle",
  jobtitle: "jobTitle",
  title: "jobTitle",
  tier: "tier",
  mode: "mode",
  dietary: "dietary",
  country: "country",
  "country / region": "country",
  accessibility: "accessibilityNotes",
  "accessibility notes": "accessibilityNotes",
  referral: "referralSource",
  "referral source": "referralSource",
  "staff id": "staffEmployeeId",
  "employee id": "staffEmployeeId",
  staffemployeeid: "staffEmployeeId",
  department: "department",
  branch: "branch",
  "rep email": "repEmail",
  "sales rep": "repEmail"
};

/** Columns that can be chosen in the mapping step (excluding name/email which are required for a row to import). */
export const CSV_IMPORT_MAP_OPTIONS: { value: keyof CsvRow; label: string }[] = [
  { value: "name", label: "Full name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "countryCode", label: "Country code (e.g. 1, 233)" },
  { value: "company", label: "Company" },
  { value: "jobTitle", label: "Job title" },
  { value: "tier", label: "Tier" },
  { value: "mode", label: "Mode" },
  { value: "dietary", label: "Dietary" },
  { value: "country", label: "Country" },
  { value: "accessibilityNotes", label: "Accessibility" },
  { value: "referralSource", label: "Referral" },
  { value: "staffEmployeeId", label: "Staff / employee ID" },
  { value: "department", label: "Department" },
  { value: "branch", label: "Branch" },
  { value: "repEmail", label: "Sales rep (email)" }
];

export function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

export function defaultColumnMappingFromHeaders(headerCells: string[]): Record<number, keyof CsvRow | "ignore"> {
  const m: Record<number, keyof CsvRow | "ignore"> = {};
  headerCells.forEach((cell, i) => {
    const k = IMPORT_HEADER_MAP[normalizeHeader(cell)] ?? "ignore";
    m[i] = k;
  });
  return m;
}

export function hasNameAndEmailMapping(mapping: Record<number, keyof CsvRow | "ignore">) {
  const values = new Set(Object.values(mapping));
  return values.has("name") && values.has("email");
}

export function hasNameAndPhoneMapping(mapping: Record<number, keyof CsvRow | "ignore">) {
  const values = new Set(Object.values(mapping));
  return values.has("name") && values.has("phone");
}

export function hasRequiredImportMapping(
  mapping: Record<number, keyof CsvRow | "ignore">,
  emailRequired: boolean
) {
  return emailRequired ? hasNameAndEmailMapping(mapping) : hasNameAndPhoneMapping(mapping);
}

export function buildRowsFromTable(
  table: string[][],
  mapping: Record<number, keyof CsvRow | "ignore">,
  opts?: { emailRequired?: boolean }
): CsvRow[] {
  const emailRequired = opts?.emailRequired !== false;
  if (table.length < 2) return [];
  const out: CsvRow[] = [];
  for (let r = 1; r < table.length; r++) {
    const cells = table[r] ?? [];
    const row: Record<string, string> = {};
    for (const [colStr, key] of Object.entries(mapping)) {
      if (key === "ignore") continue;
      const col = parseInt(colStr, 10);
      if (Number.isNaN(col)) continue;
      const field = key as keyof CsvRow;
      row[field] = cells[col]?.trim() ?? "";
    }
    const name = (row.name ?? "").trim();
    const email = (row.email ?? "").trim();
    const phone = (row.phone ?? "").trim();
    if (!name) continue;
    if (emailRequired && !email) continue;
    if (!emailRequired && !phone) continue;
    out.push({
      name,
      email: email || undefined,
      phone: phone || undefined,
      countryCode: row.countryCode,
      company: row.company,
      jobTitle: row.jobTitle,
      tier: row.tier,
      mode: row.mode,
      dietary: row.dietary,
      country: row.country,
      accessibilityNotes: row.accessibilityNotes,
      referralSource: row.referralSource,
      staffEmployeeId: row.staffEmployeeId,
      department: row.department,
      branch: row.branch,
      repEmail: row.repEmail
    });
  }
  return out;
}

/** Manual import: one guest per line. Required: name + phone; email required when event mandates it. */
export function parseManualGuestLines(text: string, opts?: { emailRequired?: boolean }): CsvRow[] {
  const emailRequired = opts?.emailRequired !== false;
  const out: CsvRow[] = [];
  const columns: Array<keyof CsvRow> = [
    "name",
    "email",
    "phone",
    "countryCode",
    "company",
    "jobTitle",
    "tier",
    "mode",
    "dietary",
    "country",
    "accessibilityNotes",
    "referralSource",
    "staffEmployeeId",
    "department",
    "branch",
    "repEmail"
  ];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const values = t.split(",").map((v) => v.trim());
    const row: Partial<CsvRow> = {};
    for (let i = 0; i < columns.length; i++) {
      const key = columns[i];
      if (!key) continue;
      const v = values[i]?.trim();
      if (v) row[key] = v;
    }
    const name = row.name?.trim() ?? "";
    const email = row.email?.trim() ?? "";
    const phone = row.phone?.trim() ?? "";
    const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !phone || !emailOk) continue;
    if (emailRequired && !email) continue;
    if (name && phone && emailOk) {
      out.push(row as CsvRow);
    }
  }
  return out;
}

export function sampleImportTemplate(): string {
  return "Name,Email,Country code,Phone,Company,Job title,Tier,Mode\nJane Doe,jane@example.com,1,5551234567,Acme,Director,B,in_person\n";
}
