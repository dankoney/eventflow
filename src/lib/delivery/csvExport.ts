import { DELIVERY_ERROR_LABELS, notificationKindLabel } from "@/lib/delivery/errorCodes";
import type { GuestCleanupRow, UnifiedDeliveryRow } from "@/lib/delivery/eventDeliveryReport";
import { formatDate } from "@/lib/utils";

export function csvCell(value: string | number | null | undefined): string {
  const v = value == null ? "" : String(value);
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function sanitizeCsvFilename(input: string): string {
  return input.replace(/[^\w.\- ]+/g, "").trim() || "delivery-report.csv";
}

export function deliveryLogCsvBody(
  rows: UnifiedDeliveryRow[],
  meta?: { eventName?: string; generatedAt?: Date }
): string {
  const lines: string[] = [];
  if (meta?.eventName) lines.push(`Event,${csvCell(meta.eventName)}`);
  lines.push(`Generated at,${csvCell((meta?.generatedAt ?? new Date()).toISOString())}`);
  lines.push("");
  lines.push(
    [
      "When",
      "Guest",
      "Guest email",
      "Type",
      "Channel",
      "Status",
      "Recipient",
      "Error code",
      "Error label",
      "Detail",
      "Source",
      "Campaign"
    ]
      .map(csvCell)
      .join(",")
  );

  for (const row of rows) {
    const errorLabel = row.errorCode ? DELIVERY_ERROR_LABELS[row.errorCode] : "";
    lines.push(
      [
        row.at.toISOString(),
        row.guestName,
        row.guestEmail ?? "",
        notificationKindLabel(row.kind),
        row.channel,
        row.status,
        row.recipient ?? "",
        row.errorCode ?? "",
        errorLabel,
        row.errorDetail ?? "",
        row.source,
        row.campaignLabel ?? ""
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export type OrgDeliveryRow = UnifiedDeliveryRow & {
  eventId: string;
  eventName: string;
};

export function orgDeliveryLogCsvBody(
  rows: OrgDeliveryRow[],
  meta?: { orgLabel?: string; generatedAt?: Date }
): string {
  const lines: string[] = [];
  if (meta?.orgLabel) lines.push(`Organization,${csvCell(meta.orgLabel)}`);
  lines.push(`Generated at,${csvCell((meta?.generatedAt ?? new Date()).toISOString())}`);
  lines.push("");
  lines.push(
    [
      "When",
      "Event",
      "Guest",
      "Guest email",
      "Type",
      "Channel",
      "Status",
      "Recipient",
      "Error code",
      "Error label",
      "Detail",
      "Source"
    ]
      .map(csvCell)
      .join(",")
  );

  for (const row of rows) {
    const errorLabel = row.errorCode ? DELIVERY_ERROR_LABELS[row.errorCode] : "";
    lines.push(
      [
        row.at.toISOString(),
        row.eventName,
        row.guestName,
        row.guestEmail ?? "",
        notificationKindLabel(row.kind),
        row.channel,
        row.status,
        row.recipient ?? "",
        row.errorCode ?? "",
        errorLabel,
        row.errorDetail ?? "",
        row.source
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export function cleanupGuestsCsvBody(
  rows: Array<GuestCleanupRow & { eventId?: string; eventName?: string }>
): string {
  const lines: string[] = [
    [
      "Event",
      "Guest",
      "Email",
      "Phone",
      "Company",
      "Failed attempts",
      "Last failure",
      "Highest severity",
      "Tags"
    ]
      .map(csvCell)
      .join(",")
  ];

  for (const g of rows) {
    lines.push(
      [
        g.eventName ?? "",
        g.guestName,
        g.email ?? "",
        g.phone ?? "",
        g.company ?? "",
        g.failedAttempts,
        g.lastFailureAt ? formatDate(g.lastFailureAt) : "",
        g.highestSeverity ?? "",
        g.tags.map((t) => t.label).join("; ")
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}
