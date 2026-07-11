export type CrmImportConflictField = "email" | "phone";

export type CrmImportIssue = {
  row: number;
  name: string;
  email: string;
  phone: string;
  conflictField: CrmImportConflictField;
  /** Normalized value that collides (email lowercased or E.164 phone). */
  duplicateValue: string;
  /** Human-readable pointer to the other row or existing CRM record. */
  conflictWith: string;
  reason: string;
};

export type CrmImportResult = {
  imported: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  issues: CrmImportIssue[];
};
