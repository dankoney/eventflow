import { z } from "zod";

import { guestHasDeliverableEmail } from "@/lib/guest/contactRequirements";
import { normalizeCompanyKey } from "@/lib/guests/companyNormalization";
import { isValidE164 } from "@/lib/phone/publicRegistrationPhone";

export type DataQualitySeverity = "info" | "warning" | "error" | "critical";

export type DataQualityTagId =
  | "NO_DELIVERABLE_EMAIL"
  | "INVALID_EMAIL_FORMAT"
  | "NO_PHONE"
  | "INVALID_PHONE_FORMAT"
  | "NO_CONTACT_CHANNEL"
  | "NOTIFICATIONS_SUPPRESSED"
  | "REPEATED_DELIVERY_FAILURES"
  | "EMAIL_DELIVERY_FAILING"
  | "SMS_DELIVERY_FAILING"
  | "COMPANY_NAME_INCONSISTENT";

export type DataQualityTag = {
  id: DataQualityTagId;
  label: string;
  severity: DataQualitySeverity;
  hint: string;
};

export const DATA_QUALITY_TAG_META: Record<DataQualityTagId, Omit<DataQualityTag, "id">> = {
  NO_DELIVERABLE_EMAIL: {
    label: "No email",
    severity: "warning",
    hint: "Add a work email for invitations, confirmations, and reminders — even when SMS is used."
  },
  INVALID_EMAIL_FORMAT: {
    label: "Invalid email",
    severity: "error",
    hint: "Fix the email format so invitations and confirmations can be delivered."
  },
  NO_PHONE: {
    label: "No phone",
    severity: "warning",
    hint: "Add an E.164 mobile number for SMS reminders and feedback links."
  },
  INVALID_PHONE_FORMAT: {
    label: "Invalid phone",
    severity: "error",
    hint: "Use international format, e.g. +233501234567."
  },
  NO_CONTACT_CHANNEL: {
    label: "Unreachable",
    severity: "critical",
    hint: "Guest cannot receive email or SMS — update contact details."
  },
  NOTIFICATIONS_SUPPRESSED: {
    label: "Suppressed",
    severity: "info",
    hint: "Automated notifications are turned off for this guest."
  },
  REPEATED_DELIVERY_FAILURES: {
    label: "Repeated failures",
    severity: "error",
    hint: "Multiple send attempts failed — verify email and phone quality."
  },
  EMAIL_DELIVERY_FAILING: {
    label: "Email failing",
    severity: "warning",
    hint: "Recent email attempts failed while SMS may still work."
  },
  SMS_DELIVERY_FAILING: {
    label: "SMS failing",
    severity: "warning",
    hint: "Recent SMS attempts failed — check phone number and mNotify setup."
  },
  COMPANY_NAME_INCONSISTENT: {
    label: "Company mismatch",
    severity: "info",
    hint: "Company spelling differs from other guests — consider normalizing in CRM."
  }
};

type GuestContactRow = {
  email: string | null;
  phone: string | null;
  company: string | null;
  notificationsSuppressedAt: Date | null;
};

type DeliveryHistorySlice = {
  emailFailed: number;
  smsFailed: number;
  totalFailed: number;
};

export type DeliveryAttemptRow = {
  at: Date;
  channel: "EMAIL" | "SMS";
  status: "SENT" | "FAILED" | "SKIPPED";
};

export type GuestDeliveryHistory = DeliveryHistorySlice & {
  lastFailureAt: Date | null;
};

/**
 * Counts only delivery issues not resolved by a later successful send on the same channel.
 * E.g. email failed → guest fixed → email sent clears email failure flags from cleanup.
 */
export function buildUnresolvedDeliveryHistory(
  attempts: DeliveryAttemptRow[]
): GuestDeliveryHistory {
  const sorted = [...attempts].sort((a, b) => {
    const diff = a.at.getTime() - b.at.getTime();
    if (diff !== 0) return diff;
    // Same timestamp: apply successful sends after failures/skips so cleanup clears correctly.
    const rank: Record<DeliveryAttemptRow["status"], number> = {
      FAILED: 0,
      SKIPPED: 0,
      SENT: 1
    };
    return rank[a.status] - rank[b.status];
  });

  let emailFailed = 0;
  let smsFailed = 0;
  let lastEmailIssueAt: Date | null = null;
  let lastSmsIssueAt: Date | null = null;

  for (const row of sorted) {
    const isIssue = row.status === "FAILED" || row.status === "SKIPPED";

    if (row.channel === "EMAIL") {
      if (row.status === "SENT") {
        emailFailed = 0;
        lastEmailIssueAt = null;
      } else if (isIssue) {
        emailFailed += 1;
        lastEmailIssueAt = row.at;
      }
    } else if (row.status === "SENT") {
      smsFailed = 0;
      lastSmsIssueAt = null;
    } else if (isIssue) {
      smsFailed += 1;
      lastSmsIssueAt = row.at;
    }
  }

  const totalFailed = emailFailed + smsFailed;
  const lastFailureAt =
    totalFailed === 0
      ? null
      : new Date(
          Math.max(lastEmailIssueAt?.getTime() ?? 0, lastSmsIssueAt?.getTime() ?? 0)
        );

  return { emailFailed, smsFailed, totalFailed, lastFailureAt };
}

export function assessGuestContactQuality(
  guest: GuestContactRow,
  history: DeliveryHistorySlice,
  opts?: { peerCompanyKeys?: Set<string> }
): DataQualityTag[] {
  const tags: DataQualityTagId[] = [];
  const emailRaw = guest.email?.trim() ?? "";
  const phoneRaw = guest.phone?.trim() ?? "";
  const hasDeliverableEmail = guestHasDeliverableEmail(guest.email);
  const hasValidPhone = phoneRaw ? isValidE164(phoneRaw) : false;

  if (guest.notificationsSuppressedAt) {
    tags.push("NOTIFICATIONS_SUPPRESSED");
  }

  if (!emailRaw) {
    tags.push("NO_DELIVERABLE_EMAIL");
  } else if (!z.string().email().safeParse(emailRaw.toLowerCase()).success) {
    tags.push("INVALID_EMAIL_FORMAT");
  } else if (!hasDeliverableEmail) {
    tags.push("INVALID_EMAIL_FORMAT");
  }

  if (!phoneRaw) {
    tags.push("NO_PHONE");
  } else if (!hasValidPhone) {
    tags.push("INVALID_PHONE_FORMAT");
  }

  if (!hasDeliverableEmail && !hasValidPhone && !guest.notificationsSuppressedAt) {
    tags.push("NO_CONTACT_CHANNEL");
  }

  if (history.totalFailed >= 2) {
    tags.push("REPEATED_DELIVERY_FAILURES");
  }
  if (history.emailFailed >= 1 && hasDeliverableEmail) {
    tags.push("EMAIL_DELIVERY_FAILING");
  }
  if (history.smsFailed >= 1 && hasValidPhone) {
    tags.push("SMS_DELIVERY_FAILING");
  }

  if (guest.company?.trim() && opts?.peerCompanyKeys?.size) {
    const key = normalizeCompanyKey(guest.company);
    if (key && !opts.peerCompanyKeys.has(key)) {
      tags.push("COMPANY_NAME_INCONSISTENT");
    }
  }

  const severityOrder: Record<DataQualitySeverity, number> = {
    critical: 0,
    error: 1,
    warning: 2,
    info: 3
  };

  return [...new Set(tags)]
    .map((id) => ({ id, ...DATA_QUALITY_TAG_META[id] }))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function highestSeverity(tags: DataQualityTag[]): DataQualitySeverity | null {
  if (tags.length === 0) return null;
  const order: DataQualitySeverity[] = ["critical", "error", "warning", "info"];
  for (const s of order) {
    if (tags.some((t) => t.severity === s)) return s;
  }
  return null;
}
