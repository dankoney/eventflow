"use client";

import { AttendMode, EventStatus, EventType, GuestStatus, Role, Tier } from "@prisma/client";
import { Building2, Download, Search, Send, Upload, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GuestMessagingDialog } from "@/components/guests/GuestMessagingDialog";
import { GuestDetailDrawer } from "@/components/guests/GuestDetailDrawer";
import { EventDeclineReasonsChart } from "@/components/guests/EventDeclineReasonsChart";
import { EventWaitlistPanel } from "@/components/guests/EventWaitlistPanel";
import { GuestForm } from "@/components/guests/GuestForm";
import { GuestCrmInviteModal } from "@/components/guests/GuestCrmInviteModal";
import { GuestExportDialog } from "@/components/guests/GuestExportDialog";
import { GuestImportWizard } from "@/components/guests/GuestImportWizard";
import { GuestStatusBadge } from "@/components/guests/GuestStatusBadge";
import { ZoomParticipantSyncPanel } from "@/components/events/ZoomParticipantSyncPanel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import {
  removeGuestFromEventAsOrganizer,
  removeGuestsFromEventAsOrganizer
} from "@/lib/actions/guest.actions";
import { assignGuestsToEventGuestGroup } from "@/lib/actions/guestGroup.actions";
import type { DeclineReasonCount } from "@/lib/db/eventDeclineAnalytics";
import type { EventWaitlistListRow } from "@/lib/db/eventWaitlist";
import type { GuestWithRep } from "@/lib/db/guests";
import type { OrgContactGuestInvitePickRow } from "@/lib/db/orgContact";
import { rowsToCsv } from "@/lib/csv";
import { canManageEventGuests, mayEditOrDeleteGuestRow } from "@/lib/rbac/capabilities";
import type { GuestExportCapability } from "@/lib/rbac/guestExport";
import { shouldNotifyGuestOfRemovalFromEvent } from "@/lib/guests/removalNotifications";
import { parseZoomAnonRosterName } from "@/lib/zoom/anonRosterName";
import { cn } from "@/lib/utils";
import type { GuestStatus as GuestStatusUi } from "@/types";

type SalesRepOption = { id: string; name: string | null; email: string };

const filterSelect =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 outline-none ring-zinc-900/10 transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

/** Mode list filter: guests with no attendance mode yet (hybrid). */
const MODE_FILTER_UNSET = "__UNSET__" as const;
const GROUP_FILTER_UNGROUPED = "__UNGROUPED__" as const;

function canDeleteGuestRow(role: Role, userId: string, g: GuestWithRep) {
  return mayEditOrDeleteGuestRow(role, userId, g.repId) && !g.contactsRedacted;
}

type SearchParamsish = { get: (k: string) => string | null; toString: () => string };

function guestsListHref(
  eventId: string,
  sp: SearchParamsish,
  updates: Record<string, string | null | undefined>
) {
  const p = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(updates)) {
    if (v == null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `/events/${eventId}/guests?${s}` : `/events/${eventId}/guests`;
}

type CrmGroupLite = { id: string; name: string };

type EventGuestGroupLite = { id: string; name: string };

type GuestManagementPanelProps = {
  eventId: string;
  eventName?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  guests: GuestWithRep[];
  salesReps: SalesRepOption[];
  role: Role;
  currentUserId: string;
  showZoomParticipantSync?: boolean;
  /** When present (e.g. from check-in “Edit guest”), open the guest drawer once. */
  openGuestId?: string;
  /** Admin / marketing: CRM directory for bulk invite. */
  showCrmInvite?: boolean;
  crmInviteContacts?: OrgContactGuestInvitePickRow[];
  crmGroups?: CrmGroupLite[];
  /** Event type for hybrid “attendance undecided” defaults in the guest form. */
  eventType?: EventType;
  /** Event-scoped guest groups (sidebar). */
  eventGuestGroups?: EventGuestGroupLite[];
  /** CRM category labels for export / segment filters. */
  contactCategories?: string[];
  /** When false, email is optional on guest forms and import. */
  emailMandatoryForRegistration?: boolean;
  /** Event status for removal confirmations and invitation timing copy. */
  eventStatus?: EventStatus;
  /** Admin / marketing: waitlist queue + manual promotion. */
  waitlistRows?: EventWaitlistListRow[];
  canPromoteWaitlist?: boolean;
  /** RSVP decline reason distribution for this event. */
  declineDistribution?: DeclineReasonCount[];
  guestExportCapability?: GuestExportCapability;
};

export function GuestManagementPanel({
  eventId,
  eventName,
  organizationName,
  organizationLogoUrl,
  guests,
  salesReps,
  role,
  currentUserId,
  showZoomParticipantSync = false,
  openGuestId,
  showCrmInvite = false,
  crmInviteContacts = [],
  crmGroups = [],
  eventType = EventType.IN_PERSON,
  eventGuestGroups = [],
  contactCategories = [],
  emailMandatoryForRegistration = true,
  eventStatus = EventStatus.DRAFT,
  waitlistRows = [],
  canPromoteWaitlist = false,
  declineDistribution = [],
  guestExportCapability = "none"
}: GuestManagementPanelProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const spRef = useRef(sp);
  spRef.current = sp;
  const [search, setSearch] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [modeFilter, setModeFilter] = useState<"ALL" | AttendMode | typeof MODE_FILTER_UNSET>("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | Tier>("ALL");

  const statusFilter = useMemo((): "ALL" | GuestStatus => {
    const s = sp.get("status");
    if (!s) return "ALL";
    if ((Object.values(GuestStatus) as string[]).includes(s)) return s as GuestStatus;
    return "ALL";
  }, [sp]);

  const groupFilter = useMemo(() => {
    const g = sp.get("group");
    if (!g || !g.trim()) return "ALL";
    const value = g.trim();
    return value === GROUP_FILTER_UNGROUPED ? GROUP_FILTER_UNGROUPED : value;
  }, [sp]);
  const [addOpen, setAddOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [crmInviteOpen, setCrmInviteOpen] = useState(false);
  const [selected, setSelected] = useState<GuestWithRep | null>(null);
  const [messagingGuest, setMessagingGuest] = useState<GuestWithRep | null>(null);
  const [messagingBlastOpen, setMessagingBlastOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<GuestWithRep | null>(null);
  const [deleteGuestTarget, setDeleteGuestTarget] = useState<GuestWithRep | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [bulkGroupBusy, setBulkGroupBusy] = useState(false);
  const [bulkGroupTarget, setBulkGroupTarget] = useState<string>("");
  const [bulkAction, setBulkAction] = useState<"edit_selected" | "delete_selected">("edit_selected");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const skipFilterEffectOnce = useRef(true);
  const [panelNotice, setPanelNotice] = useState<{
    variant: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!openGuestId) return;
    const g = guests.find((x) => x.id === openGuestId);
    if (g) setSelected(g);
  }, [openGuestId, guests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (statusFilter !== "ALL" && g.status !== statusFilter) return false;
      if (groupFilter === GROUP_FILTER_UNGROUPED) {
        if (g.eventGuestGroupId != null) return false;
      } else if (groupFilter !== "ALL" && g.eventGuestGroupId !== groupFilter) {
        return false;
      }
      if (modeFilter === MODE_FILTER_UNSET) {
        if (g.mode != null) return false;
      } else if (modeFilter !== "ALL" && g.mode !== modeFilter) {
        return false;
      }
      if (tierFilter !== "ALL" && g.tier !== tierFilter) return false;
      if (!q) return true;
      const { displayName } = parseZoomAnonRosterName(g.name, g.email);
      const hay = [displayName, g.name, g.email ?? "", g.phone ?? "", g.company ?? "", g.jobTitle ?? "", g.country ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [guests, search, modeFilter, tierFilter, statusFilter, groupFilter]);

  const pageSize = useMemo(() => {
    const n = parseInt(sp.get("perPage") ?? "25", 10) || 25;
    return ([10, 25, 50, 100] as const).includes(n as 10 | 25 | 50 | 100) ? n : 25;
  }, [sp]);

  const pageFromUrl = useMemo(() => Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1), [sp]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / pageSize) || 1),
    [filtered.length, pageSize]
  );

  const activePage = useMemo(() => Math.min(pageFromUrl, pageCount), [pageFromUrl, pageCount]);

  const pagedRows = useMemo(
    () => filtered.slice((activePage - 1) * pageSize, activePage * pageSize),
    [filtered, activePage, pageSize]
  );

  const pagedRowIdsKey = useMemo(() => pagedRows.map((g) => g.id).join(","), [pagedRows]);

  const hrefWith = useCallback(
    (updates: Record<string, string | null | undefined>) => guestsListHref(eventId, sp, updates),
    [eventId, sp]
  );

  const deletableOnPage = useMemo(
    () => pagedRows.filter((g) => canDeleteGuestRow(role, currentUserId, g)),
    [pagedRows, role, currentUserId]
  );
  const deletableIdsOnPage = useMemo(() => deletableOnPage.map((g) => g.id), [deletableOnPage]);
  const allDeletableOnPageSelected =
    deletableIdsOnPage.length > 0 && deletableIdsOnPage.every((id) => selectedIds.has(id));
  const someDeletableOnPageSelected = deletableIdsOnPage.some((id) => selectedIds.has(id));

  const bulkRemovalNotifiesAnyone = useMemo(() => {
    return [...selectedIds].some((id) => {
      const g = guests.find((x) => x.id === id);
      if (!g) return false;
      return shouldNotifyGuestOfRemovalFromEvent(eventStatus, {
        status: g.status as GuestStatus,
        invitationEmailSentAt: g.invitationEmailSentAt
      });
    });
  }, [selectedIds, guests, eventStatus]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someDeletableOnPageSelected && !allDeletableOnPageSelected;
  }, [allDeletableOnPageSelected, someDeletableOnPageSelected]);

  useEffect(() => {
    if (skipFilterEffectOnce.current) {
      skipFilterEffectOnce.current = false;
      return;
    }
    router.replace(guestsListHref(eventId, spRef.current, { page: null }));
  }, [search, modeFilter, tierFilter, statusFilter, groupFilter, router, eventId]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (pageFromUrl === activePage) return;
    router.replace(
      guestsListHref(eventId, spRef.current, { page: activePage <= 1 ? null : String(activePage) })
    );
  }, [filtered.length, pageFromUrl, activePage, router, eventId]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const onPage = pagedRowIdsKey ? pagedRowIdsKey.split(",") : [];
      for (const id of onPage) {
        if (id && prev.has(id)) next.add(id);
      }
      return next;
    });
  }, [pagedRowIdsKey, activePage, pageSize]);

  const toggleSelectAllDeletable = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allDeletableOnPageSelected) {
        for (const id of deletableIdsOnPage) next.delete(id);
      } else {
        for (const id of deletableIdsOnPage) next.add(id);
      }
      return next;
    });
  }, [allDeletableOnPageSelected, deletableIdsOnPage]);

  const toggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function exportCsvPrivacySafe(rows: GuestWithRep[]) {
    const headers = ["Name", "Company", "Job Title", "Tier"];
    const dataRows = rows.map((g) => [
      parseZoomAnonRosterName(g.name, g.email).displayName,
      g.company ?? "",
      g.jobTitle ?? "",
      g.tier
    ]);
    const csv = "\uFEFF" + rowsToCsv(headers, dataRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guests-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv(rows: GuestWithRep[]) {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Job Title",
      "Tier",
      "Group",
      "Mode",
      "Status",
      "Staff ID",
      "Department",
      "Branch",
      "Checked in at",
      "Meal (check-in)",
      "Rep",
      "Dietary",
      "Country",
      "Accessibility",
      "Referral"
    ];
    const dataRows = rows.map((g) => [
      parseZoomAnonRosterName(g.name, g.email).displayName,
      g.email ?? "",
      g.phone ?? "",
      g.company ?? "",
      g.jobTitle ?? "",
      g.tier,
      g.eventGuestGroupName ?? "",
      g.mode ?? "",
      g.status,
      g.staffEmployeeId ?? "",
      g.department ?? "",
      g.branch ?? "",
      g.checkedInAt ? new Date(g.checkedInAt).toISOString() : "",
      g.contactsRedacted ? "" : (g.latestCheckInMeal ?? ""),
      g.repName ?? g.repEmail ?? "",
      g.dietary ?? "",
      g.country ?? "",
      g.accessibilityNotes ?? "",
      g.referralSource ?? ""
    ]);
    const csv = "\uFEFF" + rowsToCsv(headers, dataRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guests-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf(rows: GuestWithRep[], options?: { omitContactFields?: boolean }) {
    const omitContact = options?.omitContactFields ?? false;
    const [{ jsPDF }] = await Promise.all([import("jspdf")]);
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    const contentWidth = pageWidth - margin * 2;
    const rowHeight = 20;
    let y = margin + 88;
    const dateFmt = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    const humanDate = (value: Date | string | null | undefined) => {
      if (!value) return "—";
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return "—";
      return dateFmt.format(d);
    };
    const prettyEnum = (value: string | null | undefined) =>
      value ? value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
    const toDataUrl = async (url: string | null | undefined): Promise<string | null> => {
      const src = url?.trim();
      if (!src) return null;
      try {
        const res = await fetch(src);
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("Could not read logo image"));
          reader.readAsDataURL(blob);
        });
        return dataUrl;
      } catch {
        return null;
      }
    };
    const logoDataUrl = await toDataUrl(organizationLogoUrl);

    const totalRegistered = rows.length;
    const checkedInCount = rows.filter((g) => g.status === GuestStatus.CHECKED_IN).length;
    const joinedCount = rows.filter((g) => g.status === GuestStatus.JOINED).length;
    const noShowCount = rows.filter((g) => g.status === GuestStatus.NO_SHOW).length;
    const showVirtualAttendanceCard =
      eventType === EventType.HYBRID || eventType === EventType.VIRTUAL;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const drawHeader = () => {
      // Watermark first so all report content renders above it.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(52);
      doc.setTextColor(244, 244, 245);
      doc.text("Eventflow", pageWidth / 2, pageHeight / 2, { align: "center", angle: -26 });

      doc.setFillColor(24, 24, 27);
      doc.rect(0, 0, pageWidth, 78, "F");

      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", margin, 16, 34, 34, undefined, "FAST");
        } catch {
          // Ignore logo rendering failures and keep exporting.
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("Attendance Report", logoDataUrl ? margin + 44 : margin, 33);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.text(eventName?.trim() || `Event ${eventId}`, logoDataUrl ? margin + 44 : margin, 56);
      doc.setFontSize(9);
      doc.setTextColor(212, 212, 216);
      doc.text(
        `${organizationName?.trim() || "Organization"} · Exported ${humanDate(new Date())}`,
        pageWidth - margin,
        56,
        { align: "right" }
      );
    };

    const stampAllPages = () => {
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        const cx = pageWidth / 2;
        const cy = pageHeight / 2;

        // Small system-generated footer statement.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(161, 161, 170);
        doc.text("System-generated attendance report by Eventflow", pageWidth / 2, pageHeight - 14, {
          align: "center"
        });
      }
    };

    const drawCard = (x: number, cardY: number, w: number, label: string, value: string) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(228, 228, 231);
      doc.roundedRect(x, cardY, w, 60, 5, 5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(113, 113, 122);
      doc.text(label.toUpperCase(), x + 10, cardY + 17);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(24, 24, 27);
      doc.text(value, x + 10, cardY + 44);
    };

    const drawTableHeader = (x: number, tableY: number, widths: number[], headers: string[]) => {
      let cx = x;
      doc.setFillColor(244, 244, 245);
      doc.rect(x, tableY, widths.reduce((s, w) => s + w, 0), rowHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(63, 63, 70);
      headers.forEach((h, i) => {
        doc.text(h, cx + 6, tableY + 14);
        cx += widths[i] ?? 0;
      });
      doc.setDrawColor(228, 228, 231);
      doc.line(x, tableY + rowHeight, x + widths.reduce((s, w) => s + w, 0), tableY + rowHeight);
    };

    const tableHeaders = omitContact
      ? ["#", "Name", "Company", "Job Title", "Tier", "Status", "Mode", "Checked In"]
      : ["#", "Name", "Company", "Email", "Phone", "Status", "Mode", "Checked In"];
    const colWidths = omitContact
      ? [26, 110, 140, 120, 52, 74, 68, 94]
      : [26, 100, 150, 158, 100, 74, 68, 94];

    drawHeader();

    const cardsY = 96;
    const gap = 12;
    const metricCards: Array<{ label: string; value: string }> = [
      { label: "Total registered", value: String(totalRegistered) },
      { label: "Total checked in", value: String(checkedInCount) },
      ...(showVirtualAttendanceCard
        ? [{ label: "Joined virtually", value: String(joinedCount) }]
        : []),
      { label: "No show", value: String(noShowCount) }
    ];
    const cardCount = metricCards.length;
    const cardW = (contentWidth - gap * (cardCount - 1)) / cardCount;
    metricCards.forEach((card, i) => {
      drawCard(margin + (cardW + gap) * i, cardsY, cardW, card.label, card.value);
    });
    y = cardsY + 76;

    const tableWidth = colWidths.reduce((s, w) => s + w, 0);
    const cellPadX = 5;
    const cellPadY = 6;
    const lineLeading = 11;
    const baseRowHeight = rowHeight;
    const textBaseline = cellPadY + 9;

    drawTableHeader(margin, y, colWidths, tableHeaders);
    y += baseRowHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(39, 39, 42);

    const wrapInCell = (text: string, colIndex: number) => {
      const innerW = (colWidths[colIndex] ?? 0) - cellPadX * 2;
      return doc.splitTextToSize(text.trim() || "—", Math.max(innerW, 8));
    };

    rows.forEach((g, idx) => {
      const values = omitContact
        ? [
            String(idx + 1),
            parseZoomAnonRosterName(g.name, g.email).displayName,
            g.company || "—",
            g.jobTitle || "—",
            g.tier || "—",
            prettyEnum(g.status),
            prettyEnum(g.mode),
            humanDate(g.checkedInAt)
          ]
        : [
            String(idx + 1),
            parseZoomAnonRosterName(g.name, g.email).displayName,
            g.company || "—",
            g.email || "—",
            g.phone || "—",
            prettyEnum(g.status),
            prettyEnum(g.mode),
            humanDate(g.checkedInAt)
          ];
      const cellLines = values.map((value, i) => wrapInCell(value, i));
      const maxLineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
      const thisRowHeight = Math.max(
        baseRowHeight,
        cellPadY * 2 + maxLineCount * lineLeading
      );

      ensureSpace(thisRowHeight);
      if (y === margin) {
        drawHeader();
        y = margin + 88;
        drawTableHeader(margin, y, colWidths, tableHeaders);
        y += baseRowHeight;
      }
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, tableWidth, thisRowHeight, "F");
      }

      let cx = margin;
      cellLines.forEach((lines, i) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(39, 39, 42);
        doc.text(lines, cx + cellPadX, y + textBaseline);
        cx += colWidths[i] ?? 0;
      });
      doc.setDrawColor(228, 228, 231);
      doc.line(margin, y + thisRowHeight - 1, margin + tableWidth, y + thisRowHeight - 1);
      y += thisRowHeight;
    });

    if (filtered.length === 0) {
      ensureSpace(28);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(113, 113, 122);
      doc.text("No guests match the current filter.", margin, y + 14);
    }

    stampAllPages();

    const safeId = eventId.replace(/[^\w-]/g, "").slice(0, 60);
    doc.save(`guests-attendance-${safeId || "event"}.pdf`);
  }

  function afterAdd(opts: { emailDelivered: boolean; invitationPendingUntilPublish?: boolean }) {
    setAddOpen(false);
    if (opts.emailDelivered) {
      setPanelNotice({
        variant: "success",
        text: "Guest added. Confirmation email was sent when policy allows."
      });
    } else if (opts.invitationPendingUntilPublish) {
      setPanelNotice({
        variant: "info",
        text: "Guest added. Invitation email and SMS will be sent when this event is published."
      });
    } else {
      setPanelNotice({
        variant: "info",
        text: "Guest was saved, but the confirmation email was not sent. Check Resend under Settings → Integrations."
      });
    }
    router.refresh();
  }

  function afterEditSave() {
    setEditGuest(null);
    router.refresh();
  }

  function requestDeleteGuest(g: GuestWithRep) {
    if (!canDeleteGuestRow(role, currentUserId, g)) return;
    setDeleteGuestTarget(g);
  }

  async function confirmDeleteGuest() {
    const g = deleteGuestTarget;
    if (!g) return;
    setDeleteBusy(true);
    const res = await removeGuestFromEventAsOrganizer({ eventId, guestId: g.id });
    setDeleteBusy(false);
    setDeleteGuestTarget(null);
    if (!res.success) {
      setPanelNotice({ variant: "error", text: res.error ?? "Could not remove guest." });
      return;
    }
    setSelected(null);
    setPanelNotice({
      variant: "success",
      text: `${parseZoomAnonRosterName(g.name, g.email).displayName} was removed from this event.`
    });
    router.refresh();
  }

  const showSelectColumn = canManageEventGuests(role);

  async function confirmBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleteBusy(true);
    const res = await removeGuestsFromEventAsOrganizer({ eventId, guestIds: [...selectedIds] });
    setBulkDeleteBusy(false);
    setBulkDeleteOpen(false);
    if (!res.success) {
      setPanelNotice({ variant: "error", text: res.error ?? "Could not remove guests." });
      return;
    }
    const n = res.data?.removed ?? 0;
    setSelectedIds(new Set());
    setPanelNotice({ variant: "success", text: n > 0 ? `Removed ${n} guest(s) from this event.` : "No guests were removed (permissions or invalid selection)." });
    setSelected(null);
    router.refresh();
  }

  async function applyBulkGroupAssignment() {
    if (selectedIds.size === 0) return;
    setBulkGroupBusy(true);
    const target = bulkGroupTarget.trim();
    const res = await assignGuestsToEventGuestGroup({
      eventId,
      guestIds: [...selectedIds],
      groupId: target ? target : null
    });
    setBulkGroupBusy(false);
    if (!res.success) {
      setPanelNotice({ variant: "error", text: res.error ?? "Could not update guest groups." });
      return;
    }
    const updated = res.updated ?? 0;
    setPanelNotice({
      variant: "success",
      text:
        updated > 0
          ? target
            ? `Assigned ${updated} selected guest(s) to the group.`
            : `Removed ${updated} selected guest(s) from groups.`
          : "No selected guests were updated (permissions or invalid selection)."
    });
    setSelectedIds(new Set());
    router.refresh();
  }

  function runBulkAction() {
    if (bulkAction === "delete_selected") {
      setBulkDeleteOpen(true);
      return;
    }
    if (selectedIds.size !== 1) {
      setPanelNotice({ variant: "info", text: "Select exactly one guest to edit." });
      return;
    }
    const id = [...selectedIds][0];
    const g = guests.find((x) => x.id === id);
    if (!g) {
      setPanelNotice({ variant: "error", text: "Selected guest is no longer available." });
      return;
    }
    if (!canDeleteGuestRow(role, currentUserId, g)) {
      setPanelNotice({ variant: "error", text: "You do not have permission to edit this guest." });
      return;
    }
    setEditGuest(g);
  }

  const drawerCanEdit = !!selected && canDeleteGuestRow(role, currentUserId, selected);
  const canSendCustomMessage = (g: GuestWithRep) =>
    canManageEventGuests(role) && canDeleteGuestRow(role, currentUserId, g) && !g.contactsRedacted;
  const canBlastGuests = role === Role.ADMIN || role === Role.MARKETING;

  const showWaitlistBlock = canPromoteWaitlist || waitlistRows.length > 0;

  return (
    <div className="space-y-5">
      {panelNotice ? (
        <WorkspaceNotice variant={panelNotice.variant} onDismiss={() => setPanelNotice(null)}>
          {panelNotice.text}
        </WorkspaceNotice>
      ) : null}
      <div
        className={cn(
          "grid gap-4",
          showWaitlistBlock ? "lg:grid-cols-2" : "lg:grid-cols-1"
        )}
      >
        {showWaitlistBlock ? (
          <EventWaitlistPanel eventId={eventId} rows={waitlistRows} canPromote={canPromoteWaitlist} />
        ) : null}
        <EventDeclineReasonsChart data={declineDistribution} />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">List filters</p>
        <p className="mt-0.5 text-xs text-zinc-500">Use the sidebar to filter by registration status, or narrow further here.</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search name, email, phone, company…"
              className="rounded-lg border-2 border-zinc-300 bg-white pl-9 text-zinc-900 shadow-inner focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className={cn(filterSelect, "border-2")}
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
            >
              <option value="ALL">Mode: All</option>
              {eventType === EventType.HYBRID ? (
                <option value={MODE_FILTER_UNSET}>Undecided (hybrid)</option>
              ) : null}
              <option value={AttendMode.IN_PERSON}>In person</option>
              <option value={AttendMode.VIRTUAL}>Virtual</option>
            </select>
            <select
              className={cn(filterSelect, "border-2")}
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
            >
              <option value="ALL">Tier: All</option>
              <option value={Tier.A}>A</option>
              <option value={Tier.B}>B</option>
              <option value={Tier.C}>C</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
          {canManageEventGuests(role) ? (
            <Button
              type="button"
              className="h-10 bg-zinc-900 px-4 font-semibold text-white hover:bg-zinc-800"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus className="mr-2 inline h-4 w-4" />
              Add guest
            </Button>
          ) : null}
          {showCrmInvite ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 border-2 border-zinc-300 px-4 font-semibold text-zinc-900 hover:bg-zinc-50"
              onClick={() => setCrmInviteOpen(true)}
            >
              <Building2 className="mr-2 inline h-4 w-4" />
              Invite from CRM
            </Button>
          ) : null}
          {showZoomParticipantSync ? <ZoomParticipantSyncPanel eventId={eventId} layout="toolbar" /> : null}
          {canBlastGuests ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 border-2 border-indigo-200 px-4 font-semibold text-indigo-900 hover:bg-indigo-50"
              onClick={() => {
                setMessagingGuest(null);
                setMessagingBlastOpen(true);
              }}
            >
              <Send className="mr-2 inline h-4 w-4" />
              Message all guests
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {guestExportCapability !== "none" ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 border-zinc-200 px-4 font-medium"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="mr-2 inline h-4 w-4" />
              Export
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="h-10 border-zinc-200 px-4 font-medium"
            onClick={() => setImportWizardOpen(true)}
          >
            <Upload className="mr-2 inline h-4 w-4" />
            Import
          </Button>
        </div>
      </div>

      {showSelectColumn && selectedIds.size > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          <div className="font-medium">
            {selectedIds.size} selected
            {someDeletableOnPageSelected
              ? ` · ${deletableIdsOnPage.filter((id) => selectedIds.has(id)).length} on this page`
              : ""}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-amber-200/80 pt-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">Grouping</label>
            <Users className="h-4 w-4 text-amber-900" aria-hidden />
            <select
              className="h-9 rounded-md border border-amber-300 bg-white px-2 text-sm text-zinc-900"
              value={bulkGroupTarget}
              onChange={(e) => setBulkGroupTarget(e.target.value)}
              disabled={bulkGroupBusy}
            >
              <option value="">Ungroup selected</option>
              {eventGuestGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              className="h-9 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
              disabled={bulkGroupBusy}
              onClick={() => void applyBulkGroupAssignment()}
            >
              {bulkGroupBusy ? "Applying…" : "Apply group"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-amber-200/80 pt-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">Action</label>
            <select
              className="h-9 rounded-md border border-amber-300 bg-white px-2 text-sm text-zinc-900"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as "edit_selected" | "delete_selected")}
            >
              <option value="edit_selected">Edit</option>
              <option value="delete_selected">Delete</option>
            </select>
            <Button
              type="button"
              variant="secondary"
              className="h-9 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
              onClick={runBulkAction}
            >
              Run action
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 overflow-hidden rounded-xl border-2 border-zinc-200 bg-white shadow-sm shadow-zinc-900/5">
        <div className="w-full max-h-[30rem] overflow-auto">
          <table className="w-full min-w-[1200px] text-left text-sm text-zinc-800">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                {showSelectColumn && deletableOnPage.length > 0 ? (
                  <th className="w-10 px-2 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300"
                      checked={allDeletableOnPageSelected}
                      onChange={toggleSelectAllDeletable}
                      aria-label="Select all on this page"
                    />
                  </th>
                ) : showSelectColumn ? (
                  <th className="w-10 px-2 py-3" />
                ) : null}
                <th className="whitespace-nowrap px-4 py-3">Name</th>
                <th className="whitespace-nowrap px-4 py-3">Anonymous</th>
                <th className="whitespace-nowrap px-4 py-3">Phone</th>
                <th className="whitespace-nowrap px-4 py-3">Company</th>
                <th className="whitespace-nowrap px-4 py-3">Group</th>
                <th className="whitespace-nowrap px-4 py-3">Mode</th>
                <th className="whitespace-nowrap px-4 py-3">Tier</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="whitespace-nowrap px-4 py-3">Meal</th>
                <th className="whitespace-nowrap px-4 py-3">Rep</th>
                {canManageEventGuests(role) ? (
                  <th className="w-12 whitespace-nowrap px-2 py-3 text-center">Msg</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {pagedRows.map((g) => {
                const { displayName, isAnonymous } = parseZoomAnonRosterName(g.name, g.email);
                const deletable = canDeleteGuestRow(role, currentUserId, g);
                return (
                  <tr
                    key={g.id}
                    className={cn("cursor-pointer transition-colors hover:bg-zinc-50/90")}
                    onClick={() => setSelected(g)}
                  >
                    {showSelectColumn ? (
                      <td className="px-2 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        {deletable ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300"
                            checked={selectedIds.has(g.id)}
                            onChange={() => toggleSelectRow(g.id)}
                            aria-label={`Select ${displayName}`}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="max-w-[240px] px-4 py-3">
                      <span className="line-clamp-2 font-semibold text-zinc-900" title={displayName}>
                        {displayName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                      {isAnonymous ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-800">
                          Yes
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{g.phone ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{g.company ?? "—"}</td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-sm text-zinc-700" title={g.eventGuestGroupName ?? undefined}>
                      {g.eventGuestGroupName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-800">
                      {g.mode == null ? "—" : g.mode === AttendMode.VIRTUAL ? "Virtual" : "In person"}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800">{g.tier}</td>
                    <td className="px-4 py-3">
                      <GuestStatusBadge status={g.status as GuestStatusUi} />
                    </td>
                    <td
                      className="max-w-[140px] truncate px-4 py-3 text-zinc-700"
                      title={g.latestCheckInMeal ?? undefined}
                    >
                      {g.contactsRedacted ? "—" : g.latestCheckInMeal ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{g.repName ?? g.repEmail ?? "—"}</td>
                    {canManageEventGuests(role) ? (
                      <td className="px-2 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        {canSendCustomMessage(g) && g.status !== GuestStatus.DECLINED ? (
                          <button
                            type="button"
                            className="inline-flex rounded-lg p-2 text-zinc-500 transition hover:bg-indigo-50 hover:text-indigo-700"
                            title="Send custom SMS or email"
                            aria-label={`Message ${displayName}`}
                            onClick={() => {
                              setMessagingBlastOpen(false);
                              setMessagingGuest(g);
                            }}
                          >
                            <Send className="h-4 w-4" aria-hidden />
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="whitespace-nowrap text-xs sm:text-sm">
                Page {activePage} of {pageCount} · {(activePage - 1) * pageSize + 1}–{Math.min(activePage * pageSize, filtered.length)} of {filtered.length}
                {filtered.length < guests.length ? ` (filtered from ${guests.length})` : ""}
              </span>
              <label className="flex items-center gap-1.5 text-xs sm:text-sm">
                <span className="text-zinc-500">Rows per page</span>
                <select
                  className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs sm:text-sm"
                  value={pageSize}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10) || 25;
                    router.push(
                      hrefWith({ perPage: n === 25 ? null : String(n), page: null })
                    );
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              {activePage <= 1 ? (
                <span className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-zinc-400">Previous</span>
              ) : (
                <Link
                  href={hrefWith({ page: activePage - 1 <= 1 ? null : String(activePage - 1) })}
                  className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                  scroll={false}
                >
                  Previous
                </Link>
              )}
              {activePage >= pageCount ? (
                <span className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-zinc-400">Next</span>
              ) : (
                <Link
                  href={hrefWith({ page: String(activePage + 1) })}
                  className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                  scroll={false}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-8 text-center text-sm text-zinc-600">
          No guests match your filters.
        </p>
      ) : null}

      <Modal
        open={addOpen}
        title="Add guest"
        subtitle="Creates a roster record. Organizer invitations send when the event is published (or immediately if it is already published or live)."
        onClose={() => setAddOpen(false)}
        size="xl"
        headerTone="dark"
      >
        <GuestForm
          eventId={eventId}
          eventType={eventType}
          emailMandatoryForRegistration={emailMandatoryForRegistration}
          eventGuestGroups={eventGuestGroups}
          salesReps={salesReps}
          role={role}
          currentUserId={currentUserId}
          onSuccess={afterAdd}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>

      <GuestImportWizard
        eventId={eventId}
        emailMandatoryForRegistration={emailMandatoryForRegistration}
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        onImported={() => {
          router.refresh();
        }}
      />

      {guestExportCapability !== "none" ? (
        <GuestExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          guests={guests}
          pickerOptions={{
            eventGuestGroups,
            contactCategories
          }}
          onExportCsv={guestExportCapability === "privacy_safe" ? exportCsvPrivacySafe : exportCsv}
          onExportPdf={(rows) =>
            exportPdf(rows, { omitContactFields: guestExportCapability === "privacy_safe" })
          }
        />
      ) : null}

      {showCrmInvite ? (
        <GuestCrmInviteModal
          eventId={eventId}
          open={crmInviteOpen}
          onOpenChange={setCrmInviteOpen}
          contacts={crmInviteContacts}
          groups={crmGroups}
          onInvited={() => router.refresh()}
        />
      ) : null}

      <Modal
        open={!!editGuest}
        title="Edit guest"
        subtitle="Updates roster fields. Email change follows your org rules."
        onClose={() => setEditGuest(null)}
        size="xl"
        headerTone="dark"
      >
        {editGuest ? (
          <GuestForm
            eventId={eventId}
            eventType={eventType}
            emailMandatoryForRegistration={emailMandatoryForRegistration}
            eventGuestGroups={eventGuestGroups}
            salesReps={salesReps}
            role={role}
            currentUserId={currentUserId}
            editingGuest={editGuest}
            onSuccess={afterEditSave}
            onCancel={() => setEditGuest(null)}
          />
        ) : null}
      </Modal>

      <GuestDetailDrawer
        guest={selected}
        onClose={() => setSelected(null)}
        canEdit={drawerCanEdit}
        canSendCustomMessage={!!selected && canSendCustomMessage(selected)}
        onRequestCustomMessage={(g) => {
          setMessagingBlastOpen(false);
          setMessagingGuest(g);
        }}
        onRequestEdit={(g) => {
          setSelected(null);
          setEditGuest(g);
        }}
      />

      <GuestMessagingDialog
        eventId={eventId}
        guest={messagingGuest}
        open={!!messagingGuest || messagingBlastOpen}
        blastMode={messagingBlastOpen}
        canBlast={canBlastGuests}
        onClose={() => {
          setMessagingGuest(null);
          setMessagingBlastOpen(false);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.size} guest(s) from this event?`}
        message={
          bulkRemovalNotifiesAnyone
            ? "This cannot be undone. Guests who were already notified or progressed past invite-only will receive an email that their registration was removed. Check-ins are removed as well."
            : "This cannot be undone. Check-ins for these guests are removed as well."
        }
        confirmLabel="Delete selected"
        cancelLabel="Cancel"
        variant="danger"
        busy={bulkDeleteBusy}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
      />

      <ConfirmDialog
        open={!!deleteGuestTarget}
        title="Remove guest from event?"
        message={
          deleteGuestTarget
            ? `Remove ${parseZoomAnonRosterName(deleteGuestTarget.name, deleteGuestTarget.email).displayName} from this event? This cannot be undone.${
                shouldNotifyGuestOfRemovalFromEvent(eventStatus, {
                  status: deleteGuestTarget.status as GuestStatus,
                  invitationEmailSentAt: deleteGuestTarget.invitationEmailSentAt
                })
                  ? " They will receive an email that their registration was removed."
                  : ""
              }`
            : ""
        }
        confirmLabel="Remove guest"
        cancelLabel="Keep guest"
        variant="danger"
        busy={deleteBusy}
        onCancel={() => setDeleteGuestTarget(null)}
        onConfirm={() => void confirmDeleteGuest()}
      />
    </div>
  );
}
