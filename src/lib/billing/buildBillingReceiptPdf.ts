import { jsPDF } from "jspdf";

import { getEventflowLogoPngBase64 } from "@/lib/brand/eventflowLogo";
import type { BillingReceiptData } from "@/lib/billing/receiptData";

type Rgb = [number, number, number];

const C = {
  ink: [24, 24, 27] as Rgb,
  muted: [113, 113, 122] as Rgb,
  border: [228, 228, 231] as Rgb,
  accent: [16, 185, 129] as Rgb,
  surface: [249, 250, 251] as Rgb,
  white: [255, 255, 255] as Rgb
};

/** A4 in points (1 pt = 1/72 in). jsPDF A4 = 210mm × 297mm. */
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const MARGIN = 48;

function setFill(doc: jsPDF, rgb: Rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setStroke(doc: jsPDF, rgb: Rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: Rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function hairline(doc: jsPDF, y: number, x1 = MARGIN, x2 = A4_WIDTH_PT - MARGIN) {
  setStroke(doc, C.border);
  doc.setLineWidth(0.6);
  doc.line(x1, y, x2, y);
}

/**
 * EventFlow platform Tax Invoice / Receipt — A4, VAT itemized.
 * Uses EventFlow branding only (not the customer org brand).
 */
export function buildBillingReceiptPdf(receipt: BillingReceiptData): Uint8Array {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true
  });

  // Guard against accidental Letter defaults in future refactors.
  if (
    Math.abs(doc.internal.pageSize.getWidth() - A4_WIDTH_PT) > 1 ||
    Math.abs(doc.internal.pageSize.getHeight() - A4_HEIGHT_PT) > 1
  ) {
    throw new Error("Billing receipt PDF must use A4 page size.");
  }

  const pageW = doc.internal.pageSize.getWidth();
  const right = pageW - MARGIN;
  let y = MARGIN;

  const logo = getEventflowLogoPngBase64();
  if (logo) {
    try {
      doc.addImage(`data:image/png;base64,${logo}`, "PNG", MARGIN, y, 110, 26);
    } catch {
      setText(doc, C.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("EventFlow", MARGIN, y + 16);
    }
  } else {
    setText(doc, C.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("EventFlow", MARGIN, y + 16);
  }

  setText(doc, C.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(receipt.title, right, y + 12, { align: "right" });
  setText(doc, C.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Receipt # ${receipt.receiptNumber}`, right, y + 26, { align: "right" });
  doc.text(receipt.dateLabel, right, y + 38, { align: "right" });

  y += 56;
  hairline(doc, y);
  y += 20;

  const colW = (pageW - MARGIN * 2 - 24) / 2;
  const leftCol = MARGIN;
  const rightCol = MARGIN + colW + 24;

  setText(doc, C.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("BILLED TO", leftCol, y);
  doc.text("FROM", rightCol, y);
  y += 14;

  setText(doc, C.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(receipt.billedTo.name, leftCol, y);
  doc.text(receipt.from.name, rightCol, y);
  y += 13;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, C.muted);
  const billedLines = [
    ...receipt.billedTo.lines,
    ...(receipt.billedTo.email ? [receipt.billedTo.email] : [])
  ];
  const fromLines = receipt.from.lines;
  const maxPartyLines = Math.max(billedLines.length, fromLines.length, 1);
  for (let i = 0; i < maxPartyLines; i++) {
    if (billedLines[i]) doc.text(billedLines[i]!, leftCol, y);
    if (fromLines[i]) doc.text(fromLines[i]!, rightCol, y);
    y += 12;
  }

  y += 10;
  hairline(doc, y);
  y += 18;

  // Table header
  setFill(doc, C.surface);
  doc.rect(MARGIN, y - 10, pageW - MARGIN * 2, 22, "F");
  setText(doc, C.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESCRIPTION", MARGIN + 8, y + 4);
  doc.text("AMOUNT (GHS)", right - 8, y + 4, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const line of receipt.lines) {
    setText(doc, line.muted ? C.muted : C.ink);
    doc.text(line.label, MARGIN + 8, y);
    const major = (line.amountPesewas / 100).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    doc.text(major, right - 8, y, { align: "right" });
    y += 16;
    if (line === receipt.lines[0] && receipt.periodLabel) {
      setText(doc, C.muted);
      doc.setFontSize(8);
      doc.text(`Period ${receipt.periodLabel}`, MARGIN + 8, y);
      y += 14;
      doc.setFontSize(10);
    }
  }

  y += 4;
  setStroke(doc, C.accent);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, y, right, y);
  y += 18;

  setText(doc, C.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", MARGIN + 8, y);
  const totalMajor = (receipt.totalPesewas / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  doc.text(totalMajor, right - 8, y, { align: "right" });
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, C.muted);
  doc.text("Status", MARGIN + 8, y);
  setText(doc, C.ink);
  doc.setFont("helvetica", "bold");
  doc.text(receipt.status, right - 8, y, { align: "right" });
  y += 20;

  hairline(doc, y);
  y += 18;

  setText(doc, C.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Payment reference: ${receipt.reference}`, MARGIN, y);
  y += 12;
  doc.text(`Method: ${receipt.paymentMethodLabel}`, MARGIN, y);
  y += 12;
  doc.text(`Plan: ${receipt.planLabel}`, MARGIN, y);

  // Footer
  const footerY = A4_HEIGHT_PT - MARGIN;
  hairline(doc, footerY - 36);
  setText(doc, C.muted);
  doc.setFontSize(8);
  const footerLines = [
    `${receipt.from.name} is a product of ${receipt.from.lines[0] ?? "Cosabonita"}. VAT-registered.`,
    receipt.from.vatTin
      ? `GRA VAT TIN: ${receipt.from.vatTin}`
      : receipt.from.vatTinIsPlaceholder
        ? "GRA VAT TIN: configure EVENTFLOW_BILLING_VAT_TIN before customer go-live."
        : "GRA VAT TIN: not configured.",
    receipt.supportEmail
      ? `Questions: reply to billing emails / ${receipt.supportEmail}`
      : "Questions: reply to billing emails.",
    "EventFlow — this is an electronically generated receipt."
  ];
  let fy = footerY - 28;
  for (const line of footerLines) {
    doc.text(line, MARGIN, fy, { maxWidth: pageW - MARGIN * 2 });
    fy += 10;
  }

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
