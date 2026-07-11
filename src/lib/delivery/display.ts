import { DELIVERY_ERROR_LABELS } from "@/lib/delivery/errorCodes";
import type { UnifiedDeliveryRow } from "@/lib/delivery/eventDeliveryReport";

/** Human-readable detail for the delivery log table (not raw internal markers). */
export function deliveryRowDetailLabel(row: UnifiedDeliveryRow): string {
  if (row.status === "FAILED" || row.status === "SKIPPED") {
    if (row.errorCode) return DELIVERY_ERROR_LABELS[row.errorCode];
    return row.errorDetail ?? "—";
  }

  const marker = row.errorDetail?.toLowerCase().trim();
  if (marker === "sms" || marker === "email" || marker === "staff check-in link") {
    return "View message";
  }

  return row.errorDetail ?? "View message";
}
