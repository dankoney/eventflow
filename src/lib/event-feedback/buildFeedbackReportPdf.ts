import { jsPDF } from "jspdf";

import { getEventflowLogoPngBase64 } from "@/lib/brand/eventflowLogo";
import type { EventFeedbackAnalytics } from "@/lib/db/eventFeedback";
import {
  collectFeedbackAnswerColumns,
  formatFeedbackAnswerForExport,
  type FeedbackAnswerColumn
} from "@/lib/event-feedback/feedbackResponseContent";
import {
  feedbackPendingResponseMetricHint,
  feedbackPendingResponseMetricLabel
} from "@/lib/event-feedback/feedbackMetrics";
import { EVENT_FEEDBACK_RATING_META } from "@/lib/event-feedback/ratings";
import { formatDate } from "@/lib/utils";

export type FeedbackReportPdfInput = {
  eventName: string;
  exportedAt: Date;
  analytics: EventFeedbackAnalytics;
  /** When true (free plan), stamp Eventflow logo watermark on every page. */
  showWatermark?: boolean;
};

type Rgb = [number, number, number];

const MARGIN = 44;
const GAP = 12;
const BAR_COLORS: Rgb[] = [
  [239, 68, 68],
  [249, 115, 22],
  [148, 163, 184],
  [34, 197, 94],
  [16, 185, 129]
];

const C = {
  ink: [24, 24, 27] as Rgb,
  muted: [113, 113, 122] as Rgb,
  border: [228, 228, 231] as Rgb,
  surface: [250, 250, 250] as Rgb,
  white: [255, 255, 255] as Rgb,
  header: [24, 24, 27] as Rgb,
  accent: [39, 39, 42] as Rgb
};

function windowPhaseLabel(analytics: EventFeedbackAnalytics): string {
  switch (analytics.window.phase) {
    case "open":
      return `Open until ${formatDate(analytics.window.closesAt)}`;
    case "closed":
      return `Closed ${formatDate(analytics.window.closesAt)}`;
    case "not_yet_open":
      return `Opens ${formatDate(analytics.window.opensAt)}`;
    default:
      return "Unavailable";
  }
}

function ratingLine(label: string, score: number): string {
  return `${label} (${score}/5)`;
}

function ratingColorIndex(score: number): number {
  return Math.min(Math.max(score - 1, 0), BAR_COLORS.length - 1);
}

function tint(rgb: Rgb, amount: number): Rgb {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * amount),
    Math.round(rgb[1] + (255 - rgb[1]) * amount),
    Math.round(rgb[2] + (255 - rgb[2]) * amount)
  ];
}

function setFill(doc: jsPDF, rgb: Rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setStroke(doc: jsPDF, rgb: Rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: Rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function drawEventflowWatermark(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  logoBase64: string | null
) {
  const cx = pageW / 2;
  const cy = pageH / 2;

  doc.saveGraphicsState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.setGState(new (doc as any).GState({ opacity: 0.09 }));

  if (logoBase64) {
    const w = 220;
    const h = 50;
    doc.addImage(
      `data:image/png;base64,${logoBase64}`,
      "PNG",
      cx - w / 2,
      cy - h / 2,
      w,
      h,
      undefined,
      "FAST"
    );
  } else {
    setFill(doc, C.accent);
    doc.roundedRect(cx - 28, cy - 28, 56, 56, 12, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("E", cx, cy + 10, { align: "center" });
    doc.setFontSize(42);
    setText(doc, [212, 212, 216]);
    doc.text("Eventflow", cx, cy + 52, { align: "center", angle: -28 });
  }

  doc.restoreGraphicsState();
}

/** Builds a management-style PDF (cards, charts, full comments). No emoji — Helvetica-safe labels only. */
export function buildFeedbackReportPdf(input: FeedbackReportPdfInput): Uint8Array {
  const { eventName, exportedAt, analytics, showWatermark = false } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  let y = 0;

  const stampAllPages = () => {
    const logoBase64 = showWatermark ? getEventflowLogoPngBase64() : null;
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      if (showWatermark) {
        drawEventflowWatermark(doc, pageW, pageH, logoBase64);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(doc, C.muted);
      doc.text(
        `Eventflow · ${formatDate(exportedAt)} · Page ${p}`,
        pageW / 2,
        pageH - 22,
        { align: "center" }
      );
    }
  };

  const newPage = () => {
    doc.addPage();
    setFill(doc, C.surface);
    doc.rect(0, 0, pageW, pageH, "F");
    y = MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - MARGIN - 28) {
      newPage();
    }
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 44 : 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setText(doc, C.ink);
    doc.text(title, MARGIN, y);
    y += 16;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setText(doc, C.muted);
      const lines = doc.splitTextToSize(subtitle, contentW);
      doc.text(lines, MARGIN, y);
      y += lines.length * 11 + 8;
    } else {
      y += 4;
    }
  };

  const drawCard = (
    x: number,
    cardY: number,
    w: number,
    h: number,
    label: string,
    value: string,
    sub?: string
  ) => {
    setFill(doc, C.white);
    setStroke(doc, C.border);
    doc.setLineWidth(0.75);
    doc.roundedRect(x, cardY, w, h, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(doc, C.muted);
    const labelLines = doc.splitTextToSize(label.toUpperCase(), w - 16);
    doc.text(labelLines, x + 10, cardY + 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    setText(doc, C.ink);
    doc.text(value, x + 10, cardY + 36);

    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(doc, C.muted);
      doc.text(sub, x + 10, cardY + h - 10);
    }
  };

  const drawMetricCards = () => {
    const cols = 3;
    const cardW = (contentW - GAP * (cols - 1)) / cols;
    const cardH = 56;
    const rows: Array<Array<{ label: string; value: string; sub?: string }>> = [
      [
        { label: "Attended", value: String(analytics.eligibleCount) },
        {
          label: feedbackPendingResponseMetricLabel(analytics.window),
          value: String(analytics.pendingResponseCount),
          sub: feedbackPendingResponseMetricHint(analytics.window)
        },
        { label: "Invited", value: String(analytics.requestedCount) }
      ],
      [
        {
          label: "Responses",
          value: String(analytics.responseCount),
          sub:
            analytics.responseRatePercent != null
              ? `${analytics.responseRatePercent}% of invited`
              : undefined
        },
        {
          label: "Avg. score",
          value: analytics.averageScore != null ? `${analytics.averageScore}` : "—",
          sub:
            analytics.averageScore != null
              ? `out of 5 · satisfaction ${analytics.satisfactionPercent ?? "—"}`
              : undefined
        },
        {
          label: "With written answers",
          value: String(analytics.writtenContentCount),
          sub:
            analytics.commentsCount > 0
              ? `${analytics.commentsCount} with free-text comment`
              : undefined
        }
      ]
    ];

    ensureSpace(rows.length * (cardH + GAP) + 8);
    for (const row of rows) {
      row.forEach((card, i) => {
        const x = MARGIN + i * (cardW + GAP);
        drawCard(x, y, cardW, cardH, card.label, card.value, card.sub);
      });
      y += cardH + GAP;
    }
    y += 4;
  };

  const drawChartLegend = (legendX: number, legendY: number, legendW: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, C.ink);
    doc.text("Color key", legendX, legendY);

    let ly = legendY + 12;
    analytics.distribution.forEach((d, i) => {
      const score = EVENT_FEEDBACK_RATING_META[d.rating].score;
      setFill(doc, BAR_COLORS[i] ?? C.accent);
      doc.roundedRect(legendX, ly - 6, 8, 8, 1, 1, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setText(doc, C.ink);
      doc.text(`${d.label} (${score}/5)`, legendX + 12, ly);
      ly += 11;
    });

    return ly;
  };

  const drawVerticalBarChart = (chartX: number, chartY: number, chartW: number, plotH: number) => {
    const total = analytics.distribution.reduce((s, d) => s + d.count, 0);
    const plotY = chartY;
    const barGap = 8;
    const barCount = analytics.distribution.length;
    const barW = (chartW - barGap * (barCount + 1)) / barCount;
    const maxCount = Math.max(1, ...analytics.distribution.map((d) => d.count));

    setStroke(doc, C.border);
    doc.setLineWidth(0.5);
    doc.line(chartX, plotY + plotH, chartX + chartW, plotY + plotH);

    analytics.distribution.forEach((d, i) => {
      const barH = total > 0 ? (d.count / maxCount) * (plotH - 8) : 0;
      const bx = chartX + barGap + i * (barW + barGap);
      const by = plotY + plotH - barH;
      setFill(doc, BAR_COLORS[i] ?? C.accent);
      doc.rect(bx, by, barW, barH, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(doc, C.ink);
      doc.text(String(d.count), bx + barW / 2, by - 6, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(doc, C.muted);
      doc.text(
        String(EVENT_FEEDBACK_RATING_META[d.rating].score),
        bx + barW / 2,
        plotY + plotH + 10,
        { align: "center" }
      );
    });

    if (total === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setText(doc, C.muted);
      doc.text("No responses yet", chartX + chartW / 2, plotY + plotH / 2, { align: "center" });
    }
  };

  /** Chart + color key (left) and distribution bars with counts (right) — single merged block. */
  const drawSatisfactionBreakdown = () => {
    const sectionH = 248;
    const innerPad = 12;
    const leftW = contentW * 0.46;
    const rightW = contentW - leftW - innerPad * 2;
    const leftX = MARGIN + innerPad;
    const rightX = MARGIN + leftW + innerPad;
    const topY = y;

    ensureSpace(sectionH + 8);

    setFill(doc, C.white);
    setStroke(doc, C.border);
    doc.setLineWidth(0.75);
    doc.roundedRect(MARGIN, topY, contentW, sectionH, 5, 5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(doc, C.ink);
    doc.text("Responses by rating", leftX, topY + 18);

    const plotH = 88;
    drawVerticalBarChart(leftX, topY + 26, leftW - innerPad, plotH);

    drawChartLegend(leftX, topY + 26 + plotH + 22, leftW - innerPad);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(doc, C.ink);
    doc.text("Share of responses", rightX, topY + 18);

    let rowY = topY + 32;
    const barMaxW = rightW - 118;

    for (let i = 0; i < analytics.distribution.length; i++) {
      const d = analytics.distribution[i]!;
      const score = EVENT_FEEDBACK_RATING_META[d.rating].score;

      setFill(doc, BAR_COLORS[i] ?? C.accent);
      doc.roundedRect(rightX, rowY - 5, 6, 6, 1, 1, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setText(doc, C.ink);
      doc.text(`${d.label} (${score}/5)`, rightX + 10, rowY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`${d.count} · ${d.percent}%`, rightX + rightW - 2, rowY, { align: "right" });

      const trackY = rowY + 6;
      setFill(doc, [244, 244, 245]);
      doc.roundedRect(rightX, trackY, barMaxW, 5, 2, 2, "F");

      if (d.percent > 0) {
        setFill(doc, BAR_COLORS[i] ?? C.accent);
        doc.roundedRect(rightX, trackY, (barMaxW * d.percent) / 100, 5, 2, 2, "F");
      }

      rowY += 26;
    }

    y = topY + sectionH + 16;
  };

  const drawRatingPill = (pillX: number, pillY: number, pillW: number, label: string, score: number) => {
    const text = ratingLine(label, score);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const textW = doc.getTextWidth(text);
    const width = Math.max(pillW, textW + 16);
    const color = BAR_COLORS[ratingColorIndex(score)] ?? C.accent;

    setFill(doc, tint(color, 0.82));
    setStroke(doc, tint(color, 0.55));
    doc.setLineWidth(0.5);
    doc.roundedRect(pillX, pillY - 10, width, 16, 8, 8, "FD");

    setText(doc, C.ink);
    doc.text(text, pillX + 8, pillY);
    return width;
  };

  const exportAnswerColumns = collectFeedbackAnswerColumns(
    analytics.feedbackQuestions,
    analytics.responses.map((r) => ({ comment: r.comment, answers: r.answers }))
  );

  const drawResponseBlock = (
    guestName: string,
    email: string,
    ratingLabel: string,
    score: number,
    comment: string | null,
    answers: Record<string, string> | null,
    answerColumns: FeedbackAnswerColumn[],
    updated: string
  ) => {
    type WrittenLine = { label: string; text: string; lines: string[]; h: number };
    const written: WrittenLine[] = [];
    const innerTextW = contentW - 48;

    const trimmedComment = comment?.trim();
    if (trimmedComment) {
      const lines = doc.splitTextToSize(trimmedComment, innerTextW);
      written.push({
        label: "Comment",
        text: trimmedComment,
        lines,
        h: lines.length * 11 + 22
      });
    }

    for (const col of answerColumns) {
      const text = formatFeedbackAnswerForExport(col.question, answers?.[col.key]);
      if (!text) continue;
      const lines = doc.splitTextToSize(text, innerTextW);
      const label = col.archived ? `${col.label} (archived)` : col.label;
      const labelLines = doc.splitTextToSize(label, innerTextW);
      written.push({
        label: labelLines[0] ?? label,
        text,
        lines,
        h: labelLines.length * 9 + lines.length * 11 + 26
      });
    }

    const bodyH = written.reduce((sum, w) => sum + w.h + 6, 0);
    const blockH = written.length > 0 ? 58 + bodyH : 52;

    ensureSpace(blockH + GAP);

    const topY = y;
    setFill(doc, C.white);
    setStroke(doc, C.border);
    doc.setLineWidth(0.75);
    doc.roundedRect(MARGIN, topY, contentW, blockH, 5, 5, "FD");

    const innerX = MARGIN + 14;
    const innerRight = MARGIN + contentW - 14;
    const row1Y = topY + 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const pillText = ratingLine(ratingLabel, score);
    const pillW = doc.getTextWidth(pillText) + 16;
    const nameMaxW = contentW - 28 - pillW - 8;

    doc.setFontSize(11);
    setText(doc, C.ink);
    const nameLines = doc.splitTextToSize(guestName, nameMaxW);
    doc.text(nameLines[0] ?? guestName, innerX, row1Y);

    drawRatingPill(innerRight - pillW, row1Y, pillW, ratingLabel, score);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, C.muted);
    doc.text(`${email}  ·  ${updated}`, innerX, row1Y + 14);

    let contentY = row1Y + 28;
    if (written.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      setText(doc, C.muted);
      doc.text("Rating only — no comment or question answers", innerX, contentY);
    } else {
      for (const block of written) {
        setFill(doc, C.surface);
        setStroke(doc, C.border);
        doc.setLineWidth(0.5);
        doc.roundedRect(innerX, contentY, contentW - 28, block.h, 4, 4, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        setText(doc, C.muted);
        doc.text(block.label, innerX + 10, contentY + 12);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setText(doc, C.ink);
        doc.text(block.lines, innerX + 10, contentY + 24);

        contentY += block.h + 6;
      }
    }

    y = topY + blockH + GAP;
  };

  // —— Page 1: cover + metrics + charts ——
  setFill(doc, C.surface);
  doc.rect(0, 0, pageW, pageH, "F");

  setFill(doc, C.header);
  doc.rect(0, 0, pageW, 88, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Event feedback report", MARGIN, 38);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(eventName, MARGIN, 58);
  doc.setFontSize(8);
  doc.setTextColor(212, 212, 216);
  doc.text(
    `Exported ${formatDate(exportedAt)} · Collection ${formatDate(analytics.window.opensAt)} – ${formatDate(analytics.window.closesAt)} (${analytics.collectionDays} days) · ${windowPhaseLabel(analytics)}`,
    MARGIN,
    74
  );

  y = 108;

  drawSectionTitle("Key metrics", "Overview aligned with the event analytics dashboard.");
  drawMetricCards();

  drawSectionTitle(
    "Satisfaction & rating breakdown",
    "Bar chart shows response volume; colored bars on the right show each rating's share. Promoters (4–5) vs detractors (1–2) drive the satisfaction index."
  );
  drawSatisfactionBreakdown();

  if (analytics.responses.length > 0) {
    ensureSpace(48);
    drawSectionTitle(
      "Responses & comments",
      `${analytics.responseCount} response${analytics.responseCount === 1 ? "" : "s"} · ${analytics.writtenContentCount} with comments or question answers${
        analytics.feedbackAnonymous ? " · Anonymous mode (names hidden)" : ""
      }`
    );

    for (const r of analytics.responses) {
      drawResponseBlock(
        r.guestName,
        r.guestEmail,
        r.label,
        r.score,
        r.comment,
        r.answers,
        exportAnswerColumns,
        formatDate(r.updatedAt)
      );
    }
  } else {
    ensureSpace(24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(doc, C.muted);
    doc.text("No responses yet.", MARGIN, y);
  }

  stampAllPages();

  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf);
}
