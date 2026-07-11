"use client";

import {
  EventBlueprintTemplate,
  EventType,
  InternalStaffEmailTemplateKind,
  InternalStaffCheckInMode,
  InternalStaffMealMenuScope,
  InternalStaffNoticeKind,
  InternalStaffSmsTemplateKind
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InternalStaffNoticeForm, type InternalStaffNoticeSettings } from "@/components/event-wizard/InternalStaffNoticeForm";
import { StaffPolicyForm, type StaffPolicyDirectoryMeta } from "@/components/event-wizard/StaffPolicyForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { WorkspaceNotice } from "@/components/ui/WorkspaceNotice";
import { WorkspaceToast, type WorkspaceToastState } from "@/components/ui/WorkspaceToast";
import {
  dispatchInternalStaffPersonalCheckInLinksAction,
  previewInternalStaffBlankEmailAction,
  resyncInternalStaffGuestsForEventAction,
  updateInternalStaffMeetingSettings
} from "@/lib/actions/event.actions";
import type { JSONContent } from "@tiptap/core";
import { parseInternalStaffEmailMailyJson } from "@/lib/internalStaff/emailMailyJson";
import type { DefaultEventBrandColors } from "@/lib/email/defaultEventBranding";
import { internalStaffAudienceForPrisma, type InternalStaffAudience } from "@/lib/internalStaff/audience";
import {
  defaultInternalStaffNoticeFrom,
  extractMeetingRoomFromNoticeContext,
  resolveInternalStaffNoticeSubject,
  resolveMemoToForEvent,
  resolvePlatformLine,
  resolveStaffNoticeActionLabel,
  resolveStaffNoticeActionUrl,
  resolveStaffNoticeCheckInInstruction,
  stripLegacyMeetingRoomMarkers
} from "@/lib/internalStaff/noticeCopy";
import type { InternalStaffBranchMealMenuRow } from "@/lib/internalStaff/mealMenu";
import { renderInternalStaffNoticeSms } from "@/lib/sms/internalStaffNoticeSms";
import {
  renderInternalStaffNoticeEmailHtml
} from "@/lib/email/internalStaffNoticeTemplate";

type BranchMenuDraft = { branch: string; lines: string };

type InternalStaffAudienceEditPanelProps = {
  eventId: string;
  /** When true (e.g. completed/cancelled event), all controls are disabled for the same layout as live edits. */
  readOnly?: boolean;
  initialAudience: unknown;
  initialAllowFlashEntry: boolean;
  initialCheckInMode: InternalStaffCheckInMode;
  initialMealMenuEnabled: boolean;
  initialMealMenuScope: InternalStaffMealMenuScope;
  initialMealMenuItems: string[];
  initialMealMenusByBranch: InternalStaffBranchMealMenuRow[];
  initialNoticeKind: InternalStaffNoticeKind;
  initialNoticeTo: string | null;
  initialNoticeFrom: string | null;
  initialNoticeCc: string | null;
  initialNoticeContext: string | null;
  initialMeetingRoom?: string | null;
  initialNoticeSubject?: string | null;
  initialEmailTemplateKind?: InternalStaffEmailTemplateKind | null;
  initialSmsTemplateKind?: InternalStaffSmsTemplateKind | null;
  initialSmsCustomText?: string | null;
  initialEmailMailyJson?: unknown;
  staffDirectoryMeta: StaffPolicyDirectoryMeta | null;
  // Preview inputs — keep these in sync with what send uses.
  eventName: string;
  eventDateIso: string;
  eventType: EventType;
  zoomJoinUrl: string | null;
  locationLabel: string;
  eventDescription: string | null;
  orgName: string;
  orgInternalStaffFooterContact: string | null;
  orgLogoUrl: string | null;
  brandColors: DefaultEventBrandColors;
};

function branchDraftsFromInitial(rows: InternalStaffBranchMealMenuRow[]): BranchMenuDraft[] {
  if (rows.length === 0) return [{ branch: "", lines: "" }];
  return rows.map((r) => ({ branch: r.branch, lines: r.items.join("\n") }));
}

const field =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

function formatNoticesSentLine(notices: { emailed: number; smsSent: number; whatsappSent: number }): string {
  const parts: string[] = [];
  if (notices.emailed > 0) parts.push(`${notices.emailed} email`);
  if (notices.smsSent > 0) parts.push(`${notices.smsSent} SMS`);
  if (notices.whatsappSent > 0) parts.push(`${notices.whatsappSent} WhatsApp`);
  if (parts.length === 0) return "Staff notices queued (no deliverable contacts for new guests).";
  return `Staff notices sent to new guests: ${parts.join(", ")}.`;
}

function noticeSettingsFromInitial(params: {
  initialNoticeKind: InternalStaffNoticeKind;
  initialEmailTemplateKind?: InternalStaffEmailTemplateKind | null;
  initialSmsTemplateKind?: InternalStaffSmsTemplateKind | null;
  initialSmsCustomText?: string | null;
  initialEmailMailyJson?: unknown;
  initialNoticeTo: string | null;
  initialNoticeFrom: string | null;
  initialNoticeCc: string | null;
  initialNoticeContext: string | null;
  initialMeetingRoom?: string | null;
  initialNoticeSubject?: string | null;
}): InternalStaffNoticeSettings {
  const legacy = extractMeetingRoomFromNoticeContext(params.initialNoticeContext);
  return {
    noticeKind: params.initialNoticeKind,
    emailTemplateKind: params.initialEmailTemplateKind ?? InternalStaffEmailTemplateKind.MEMORANDUM,
    smsTemplateKind: params.initialSmsTemplateKind ?? InternalStaffSmsTemplateKind.STANDARD,
    smsCustomText: params.initialSmsCustomText ?? "",
    emailCustomMailyJson: parseInternalStaffEmailMailyJson(params.initialEmailMailyJson),
    noticeTo: params.initialNoticeTo ?? "",
    noticeFrom: params.initialNoticeFrom ?? "",
    noticeCc: params.initialNoticeCc ?? "",
    noticeSubject: params.initialNoticeSubject?.trim() ?? "",
    noticeContext:
      stripLegacyMeetingRoomMarkers(params.initialNoticeContext) || legacy.noticeContext,
    meetingRoom: params.initialMeetingRoom?.trim() || legacy.meetingRoom
  };
}

function InternalStaffNoticePreview(props: {
  eventId: string;
  eventName: string;
  eventDateIso: string;
  orgName: string;
  orgLogoUrl: string | null;
  brandColors: DefaultEventBrandColors;
  noticeKind: InternalStaffNoticeKind;
  emailTemplateKind: InternalStaffEmailTemplateKind;
  smsTemplateKind: InternalStaffSmsTemplateKind;
  smsCustomText: string;
  emailCustomMailyJson: JSONContent;
  noticeTo: string;
  noticeFrom: string;
  noticeCc: string;
  noticeSubject: string;
  noticeContext: string;
  meetingRoom: string;
  audience: InternalStaffAudience;
  checkInMode: InternalStaffCheckInMode;
  allowPersonalLinkToken: boolean;
  eventType: EventType;
  zoomJoinUrl: string | null;
  locationLabel: string;
  eventDescription: string | null;
  orgInternalStaffFooterContact: string | null;
  memoDate: Date;
}) {
  const eventDate = new Date(props.eventDateIso);
  const hasPersonalLink = Boolean(props.allowPersonalLinkToken);
  const isBlankEmail = props.emailTemplateKind === InternalStaffEmailTemplateKind.BLANK;
  const [blankEmailHtml, setBlankEmailHtml] = useState<string | null>(null);

  const personalUrl = hasPersonalLink ? `/register/${props.eventId}/i/[token]` : null;
  const sharedUrl = `/register/${props.eventId}`;
  const actionUrl = resolveStaffNoticeActionUrl({
    eventType: props.eventType,
    eventId: props.eventId,
    personalCheckInUrl: personalUrl,
    sharedCheckInUrl: sharedUrl
  });
  const actionLabel = resolveStaffNoticeActionLabel({
    eventType: props.eventType,
    hasActionUrl: Boolean(actionUrl)
  });

  const checkInInstruction = resolveStaffNoticeCheckInInstruction({
    eventType: props.eventType,
    checkInMode: props.checkInMode,
    hasPersonalLink
  });

  const memoTo = resolveMemoToForEvent(props.noticeTo.trim() || null, props.audience);

  const memoFrom = props.noticeFrom.trim()
    ? props.noticeFrom.trim()
    : props.orgInternalStaffFooterContact?.trim() ||
      defaultInternalStaffNoticeFrom(props.orgName);

  const memoCc = props.noticeCc.trim() || null;
  const fallbackContext = props.noticeContext?.trim() || props.eventDescription?.trim() || null;
  const contextParagraph =
    props.emailTemplateKind === InternalStaffEmailTemplateKind.BLANK
      ? props.noticeContext.trim() || null
      : fallbackContext;

  // `formatLocationLine()` renders as: "<name> — <address>"
  const platformLine = resolvePlatformLine({
    eventType: props.eventType,
    locationLabel: props.locationLabel,
    meetingRoom: props.meetingRoom
  });

  const subject = resolveInternalStaffNoticeSubject({
    noticeKind: props.noticeKind,
    eventName: props.eventName,
    customSubject: props.noticeSubject
  });

  useEffect(() => {
    if (!isBlankEmail) {
      setBlankEmailHtml(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await previewInternalStaffBlankEmailAction({
        editorState: props.emailCustomMailyJson as Record<string, unknown>,
        mergeContext: {
          guestName: "Alex Morgan",
          eventName: props.eventName,
          eventDateIso: props.eventDateIso,
          noticeKind: props.noticeKind,
          noticeSubject: props.noticeSubject.trim() || null,
          memoTo,
          memoFrom,
          memoCc,
          meetingRoom: props.meetingRoom.trim() || null,
          venueLine: platformLine,
          orgName: props.orgName,
          orgLogoUrl: props.orgLogoUrl,
          checkInLink: actionUrl
        }
      });
      if (!cancelled && res.success && res.data) {
        setBlankEmailHtml(res.data.html);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isBlankEmail,
    props.emailCustomMailyJson,
    props.eventName,
    props.eventDateIso,
    props.noticeKind,
    props.noticeSubject,
    props.meetingRoom,
    props.orgName,
    props.orgLogoUrl,
    memoTo,
    memoFrom,
    memoCc,
    platformLine,
    actionUrl
  ]);

  const emailHtml = isBlankEmail
    ? blankEmailHtml
    : renderInternalStaffNoticeEmailHtml({
        to: memoTo,
        guestName: "Staff",
        orgName: props.orgName,
        orgLogoUrl: props.orgLogoUrl,
        brandColors: props.brandColors,
        eventName: props.eventName,
        eventDate,
        noticeKind: props.noticeKind,
        emailTemplateKind: props.emailTemplateKind,
        memoTo,
        memoFrom,
        memoCc,
        memoDate: props.memoDate,
        memoSubject: props.noticeSubject,
        contextParagraph,
        platformLine,
        checkInInstruction,
        actionUrl,
        actionLabel
      });

  const smsText = renderInternalStaffNoticeSms({
    noticeKind: props.noticeKind,
    eventName: props.eventName,
    eventDate,
    hasPersonalLink: Boolean(actionUrl) && hasPersonalLink,
    actionUrl,
    smsTemplateKind: props.smsTemplateKind,
    smsCustomText: props.smsCustomText
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Email subject</p>
        <p className="mt-2 text-sm font-semibold text-zinc-900">{subject}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Email preview</p>
        <div
          className="max-h-[320px] overflow-auto rounded-lg border border-zinc-200 bg-white"
          dangerouslySetInnerHTML={{
            __html:
              emailHtml ??
              '<p style="padding:16px;font-family:Inter,sans-serif;font-size:14px;color:#64748b;">Rendering preview…</p>'
          }}
        />
      </div>

      <div className="space-y-2 border-t border-zinc-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">SMS preview</p>
        <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-900">
          {smsText}
        </pre>
      </div>
    </div>
  );
}

export function InternalStaffAudienceEditPanel({
  eventId,
  readOnly = false,
  initialAudience,
  initialAllowFlashEntry,
  initialCheckInMode,
  initialMealMenuEnabled,
  initialMealMenuScope,
  initialMealMenuItems,
  initialMealMenusByBranch,
  initialNoticeKind,
  initialNoticeTo,
  initialNoticeFrom,
  initialNoticeCc,
  initialNoticeContext,
  initialMeetingRoom,
  initialNoticeSubject,
  initialEmailTemplateKind,
  initialSmsTemplateKind,
  initialSmsCustomText,
  initialEmailMailyJson,
  staffDirectoryMeta,
  eventName,
  eventDateIso,
  eventType,
  zoomJoinUrl,
  locationLabel,
  eventDescription,
  orgName,
  orgInternalStaffFooterContact,
  orgLogoUrl,
  brandColors
}: InternalStaffAudienceEditPanelProps) {
  const router = useRouter();
  const [audience, setAudience] = useState<InternalStaffAudience>(() =>
    internalStaffAudienceForPrisma(EventBlueprintTemplate.INTERNAL_STAFF, initialAudience)
  );
  const [allowFlashEntry, setAllowFlashEntry] = useState(initialAllowFlashEntry);
  const [checkInMode, setCheckInMode] = useState<InternalStaffCheckInMode>(initialCheckInMode);
  const [mealMenuEnabled, setMealMenuEnabled] = useState(initialMealMenuEnabled);
  const [mealScope, setMealScope] = useState<InternalStaffMealMenuScope>(initialMealMenuScope);
  const [mealMenuLines, setMealMenuLines] = useState(() => initialMealMenuItems.join("\n"));
  const [branchMenus, setBranchMenus] = useState<BranchMenuDraft[]>(() =>
    branchDraftsFromInitial(initialMealMenusByBranch)
  );
  const [noticeSettings, setNoticeSettings] = useState<InternalStaffNoticeSettings>(() =>
    noticeSettingsFromInitial({
      initialNoticeKind,
      initialEmailTemplateKind,
      initialSmsTemplateKind,
      initialSmsCustomText,
      initialEmailMailyJson,
      initialNoticeTo,
      initialNoticeFrom,
      initialNoticeCc,
      initialNoticeContext,
      initialMeetingRoom,
      initialNoticeSubject
    })
  );
  const [busySave, setBusySave] = useState(false);
  const [busySync, setBusySync] = useState(false);
  const [busySend, setBusySend] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState<WorkspaceToastState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<"success" | "info">("success");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllowFlashEntry(initialAllowFlashEntry);
  }, [initialAllowFlashEntry]);

  async function onSaveAudience() {
    setError(null);
    setMessage(null);
    setMessageVariant("success");
    setBusySave(true);
    const mealItems = mealMenuLines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const branchPayloadRaw =
      mealMenuEnabled && mealScope === InternalStaffMealMenuScope.BY_BRANCH
        ? branchMenus
            .map((row) => ({
              branch: row.branch.trim(),
              items: row.lines
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            }))
            .filter((r) => r.branch.length > 0)
        : [];
    const branchPayload = branchPayloadRaw.length > 0 ? branchPayloadRaw : null;
    const res = await updateInternalStaffMeetingSettings({
      eventId,
      audience,
      allowFlashEntry,
      internalStaffCheckInMode: checkInMode,
      internalStaffMealMenuEnabled: mealMenuEnabled,
      internalStaffMealMenuScope: mealMenuEnabled ? mealScope : InternalStaffMealMenuScope.ALL_STAFF,
      internalStaffMealMenuItems:
        mealMenuEnabled && mealScope === InternalStaffMealMenuScope.ALL_STAFF ? mealItems : null,
      internalStaffMealMenusByBranch:
        mealMenuEnabled && mealScope === InternalStaffMealMenuScope.BY_BRANCH ? branchPayload : null,
      internalStaffNoticeKind: noticeSettings.noticeKind,
      internalStaffEmailTemplateKind: noticeSettings.emailTemplateKind,
      internalStaffSmsTemplateKind: noticeSettings.smsTemplateKind,
      internalStaffSmsCustomText: noticeSettings.smsCustomText,
      internalStaffEmailMailyJson: noticeSettings.emailCustomMailyJson as Record<string, unknown>,
      internalStaffNoticeTo: noticeSettings.noticeTo.trim() || null,
      internalStaffNoticeFrom: noticeSettings.noticeFrom.trim() || null,
      internalStaffNoticeCc: noticeSettings.noticeCc.trim() || null,
      internalStaffNoticeContext: noticeSettings.noticeContext.trim() || null,
      internalStaffNoticeSubject: noticeSettings.noticeSubject.trim() || null,
      internalStaffMeetingRoom: noticeSettings.meetingRoom.trim() || null
    });
    setBusySave(false);
    if (!res.success) {
      setError(res.error ?? "Could not save.");
      return;
    }
    setMessage("Audience, check-in policy, and meal settings saved.");
    setToast({ variant: "success", message: "Audience, check-in policy, and meal settings saved." });
    router.refresh();
  }

  async function onResync() {
    setError(null);
    setMessage(null);
    setMessageVariant("success");
    setBusySync(true);
    const res = await resyncInternalStaffGuestsForEventAction({ eventId });
    setBusySync(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Re-sync failed.");
      setToast({ variant: "error", message: res.error ?? "Re-sync failed." });
      return;
    }
    const { removed, added, targetCount, noticesSent } = res.data;
    if (removed === 0 && added === 0) {
      const infoMsg = `Guest list is already in sync. Audience matches ${targetCount} contacts in the directory.`;
      setMessageVariant("info");
      setMessage(infoMsg);
      setToast({ variant: "info", message: infoMsg });
    } else {
      let successMsg = `Guest list updated: removed ${removed}, added ${added}. Audience matches ${targetCount} contacts.`;
      if (added > 0 && noticesSent) {
        successMsg = `${successMsg} ${formatNoticesSentLine(noticesSent)}`;
      } else if (added > 0) {
        successMsg = `${successMsg} Staff notices will send when the event is published.`;
      }
      setMessageVariant("success");
      setMessage(successMsg);
      setToast({ variant: "success", message: successMsg });
    }
    router.refresh();
  }

  async function onConfirmSendPersonalLinks() {
    setPreviewOpen(false);
    setError(null);
    setMessage(null);
    setMessageVariant("success");
    setBusySend(true);
    const mealItems = mealMenuLines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const branchPayloadRaw =
      mealMenuEnabled && mealScope === InternalStaffMealMenuScope.BY_BRANCH
        ? branchMenus
            .map((row) => ({
              branch: row.branch.trim(),
              items: row.lines
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            }))
            .filter((r) => r.branch.length > 0)
        : [];
    const branchPayload = branchPayloadRaw.length > 0 ? branchPayloadRaw : null;
    const saveRes = await updateInternalStaffMeetingSettings({
      eventId,
      audience,
      allowFlashEntry,
      internalStaffCheckInMode: checkInMode,
      internalStaffMealMenuEnabled: mealMenuEnabled,
      internalStaffMealMenuScope: mealMenuEnabled ? mealScope : InternalStaffMealMenuScope.ALL_STAFF,
      internalStaffMealMenuItems:
        mealMenuEnabled && mealScope === InternalStaffMealMenuScope.ALL_STAFF ? mealItems : null,
      internalStaffMealMenusByBranch:
        mealMenuEnabled && mealScope === InternalStaffMealMenuScope.BY_BRANCH ? branchPayload : null,
      internalStaffNoticeKind: noticeSettings.noticeKind,
      internalStaffEmailTemplateKind: noticeSettings.emailTemplateKind,
      internalStaffSmsTemplateKind: noticeSettings.smsTemplateKind,
      internalStaffSmsCustomText: noticeSettings.smsCustomText,
      internalStaffEmailMailyJson: noticeSettings.emailCustomMailyJson as Record<string, unknown>,
      internalStaffNoticeTo: noticeSettings.noticeTo.trim() || null,
      internalStaffNoticeFrom: noticeSettings.noticeFrom.trim() || null,
      internalStaffNoticeCc: noticeSettings.noticeCc.trim() || null,
      internalStaffNoticeContext: noticeSettings.noticeContext.trim() || null,
      internalStaffNoticeSubject: noticeSettings.noticeSubject.trim() || null,
      internalStaffMeetingRoom: noticeSettings.meetingRoom.trim() || null
    });
    if (!saveRes.success) {
      setBusySend(false);
      setError(saveRes.error ?? "Could not save staff notice settings.");
      return;
    }
    const res = await dispatchInternalStaffPersonalCheckInLinksAction({ eventId });
    setBusySend(false);
    if (!res.success || !res.data) {
      setError(res.error ?? "Could not send links.");
      return;
    }
    const sendMsg = `Staff notices resent: ${res.data.emailed} email(s), ${res.data.smsSent} SMS, ${res.data.whatsappSent} WhatsApp (where configured).`;
    setMessage(sendMsg);
    setToast({ variant: "success", message: sendMsg });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <WorkspaceToast toast={toast} onDismiss={() => setToast(null)} />
      {readOnly ? (
        <WorkspaceNotice variant="info">
          This event is archived. Audience, check-in mode, and meal settings are read-only for reference.
        </WorkspaceNotice>
      ) : null}
      <fieldset disabled={readOnly} className="min-w-0 space-y-5 border-0 p-0 disabled:cursor-not-allowed">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Audience rules</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Adjust who should be on the guest list, then re-sync. Only invited guests without a QR or personal Zoom link
          are removed when they no longer match the audience; checked-in guests are kept.
        </p>
      </div>

      {error ? (
        <WorkspaceNotice variant="error" onDismiss={() => setError(null)}>
          {error}
        </WorkspaceNotice>
      ) : null}
      {message ? (
        <WorkspaceNotice variant={messageVariant} onDismiss={() => setMessage(null)}>
          {message}
        </WorkspaceNotice>
      ) : null}

      <StaffPolicyForm
        audience={audience}
        onAudienceChange={setAudience}
        directoryMeta={staffDirectoryMeta}
        internalStaffCheckInMode={checkInMode}
        onInternalStaffCheckInModeChange={setCheckInMode}
        allowFlashEntry={allowFlashEntry}
        onAllowFlashEntryChange={setAllowFlashEntry}
        noticeSettings={noticeSettings}
        onNoticeSettingsChange={setNoticeSettings}
        eventType={eventType}
      />

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
        <p className="text-sm font-semibold text-zinc-900">Email &amp; SMS preview</p>
        <p className="mt-1 text-sm text-zinc-600">
          Updates as you edit memo content, meeting room, and venue. Matches what staff receive when you send notices.
        </p>
        <div className="mt-4">
          <InternalStaffNoticePreview
            eventId={eventId}
            eventName={eventName}
            eventDateIso={eventDateIso}
            orgName={orgName}
            orgLogoUrl={orgLogoUrl}
            brandColors={brandColors}
            noticeKind={noticeSettings.noticeKind}
            emailTemplateKind={noticeSettings.emailTemplateKind}
            smsTemplateKind={noticeSettings.smsTemplateKind}
            smsCustomText={noticeSettings.smsCustomText}
            emailCustomMailyJson={noticeSettings.emailCustomMailyJson}
            noticeTo={noticeSettings.noticeTo}
            noticeFrom={noticeSettings.noticeFrom}
            noticeCc={noticeSettings.noticeCc}
            noticeSubject={noticeSettings.noticeSubject}
            noticeContext={noticeSettings.noticeContext}
            meetingRoom={noticeSettings.meetingRoom}
            audience={audience}
            checkInMode={checkInMode}
            allowPersonalLinkToken={checkInMode === InternalStaffCheckInMode.PERSONAL_LINK}
            eventType={eventType}
            zoomJoinUrl={zoomJoinUrl}
            locationLabel={locationLabel}
            eventDescription={eventDescription}
            orgInternalStaffFooterContact={orgInternalStaffFooterContact}
            memoDate={new Date()}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-zinc-400 text-zinc-900 focus:ring-zinc-900"
            checked={mealMenuEnabled}
            onChange={(e) => setMealMenuEnabled(e.target.checked)}
          />
          <span>
            <span className="font-semibold text-zinc-900">Meal menu at self check-in</span>
            <span className="mt-1 block text-sm font-normal text-zinc-600">
              When enabled, guests pick a meal before check-in completes. Use one list for everyone, or different lists
              per branch (guest branch comes from the contact directory when you re-sync).
            </span>
          </span>
        </label>
        {mealMenuEnabled ? (
          <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4">
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-wide text-zinc-500">Menu scope</legend>
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="radio"
                    name="meal-scope"
                    className="border-zinc-400 text-zinc-900 focus:ring-zinc-900"
                    checked={mealScope === InternalStaffMealMenuScope.ALL_STAFF}
                    onChange={() => setMealScope(InternalStaffMealMenuScope.ALL_STAFF)}
                  />
                  All staff (same options for everyone)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="radio"
                    name="meal-scope"
                    className="border-zinc-400 text-zinc-900 focus:ring-zinc-900"
                    checked={mealScope === InternalStaffMealMenuScope.BY_BRANCH}
                    onChange={() => setMealScope(InternalStaffMealMenuScope.BY_BRANCH)}
                  />
                  By branch (match guest branch to CRM contact data / guest list)
                </label>
              </div>
            </fieldset>

            {mealScope === InternalStaffMealMenuScope.ALL_STAFF ? (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Menu (one option per line)
                </label>
                <textarea
                  className={field}
                  rows={5}
                  value={mealMenuLines}
                  onChange={(e) => setMealMenuLines(e.target.value)}
                  placeholder={"Grilled chicken\nVegetarian curry\nFish plate"}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-600">
                  Branch names must match the <strong className="font-semibold text-zinc-800">Branch</strong> field on
                  CRM contact records (re-sync updates guest branches from CRM).
                </p>
                {branchMenus.map((row, idx) => (
                  <div key={idx} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[140px] flex-1">
                        <label className="text-xs font-semibold text-zinc-600">Branch name</label>
                        <input
                          className={field}
                          value={row.branch}
                          onChange={(e) => {
                            const next = [...branchMenus];
                            next[idx] = { ...next[idx], branch: e.target.value };
                            setBranchMenus(next);
                          }}
                          placeholder="e.g. Accra HQ"
                        />
                      </div>
                      {branchMenus.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition hover:bg-red-50"
                          onClick={() => setBranchMenus(branchMenus.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <label className="mt-2 block text-xs font-semibold text-zinc-600">Meals (one per line)</label>
                    <textarea
                      className={field}
                      rows={4}
                      value={row.lines}
                      onChange={(e) => {
                        const next = [...branchMenus];
                        next[idx] = { ...next[idx], lines: e.target.value };
                        setBranchMenus(next);
                      }}
                      placeholder={"Chicken box\nVegetarian"}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 transition hover:bg-zinc-100"
                  onClick={() => setBranchMenus([...branchMenus, { branch: "", lines: "" }])}
                >
                  + Add branch
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
        <Button
          type="button"
          className="bg-zinc-900 font-semibold text-white hover:bg-zinc-800"
          disabled={readOnly || busySave || busySync || busySend}
          onClick={() => void onSaveAudience()}
        >
          {busySave ? "Saving…" : "Save audience & policies"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="border-zinc-200 font-semibold"
          disabled={readOnly || busySave || busySync || busySend}
          onClick={() => void onResync()}
        >
          {busySync ? "Re-syncing…" : "Re-sync guest list"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="border-zinc-200 font-semibold"
          disabled={readOnly || busySave || busySync || busySend}
          onClick={() => setPreviewOpen(true)}
        >
          {busySend ? "Sending…" : "Resend all notices"}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        New guests receive memo email and SMS automatically when you publish the event or re-sync while published.
        Use <strong className="font-semibold text-zinc-700">Resend all notices</strong> after changing memo content, or
        to blast everyone again regardless of prior delivery.
      </p>
      </fieldset>
      <Modal
        open={previewOpen}
        title="Resend staff notices"
        subtitle="Preview then send to the full roster"
        onClose={() => setPreviewOpen(false)}
        headerTone="dark"
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full border-zinc-200 sm:w-auto"
              disabled={busySend}
              onClick={() => setPreviewOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full bg-zinc-900 font-semibold text-white hover:bg-zinc-800 sm:w-auto"
              disabled={busySend}
              onClick={() => void onConfirmSendPersonalLinks()}
            >
              {busySend ? "Sending…" : "Resend to everyone"}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm leading-relaxed text-zinc-600">
          This resends the memo email and SMS to every roster guest, including people who already received a notice.
          Save your latest memo content first if you changed templates or wording.
        </p>
        <InternalStaffNoticePreview
          eventId={eventId}
          eventName={eventName}
          eventDateIso={eventDateIso}
          orgName={orgName}
          orgLogoUrl={orgLogoUrl}
          brandColors={brandColors}
          noticeKind={noticeSettings.noticeKind}
          emailTemplateKind={noticeSettings.emailTemplateKind}
          smsTemplateKind={noticeSettings.smsTemplateKind}
          smsCustomText={noticeSettings.smsCustomText}
          emailCustomMailyJson={noticeSettings.emailCustomMailyJson}
          noticeTo={noticeSettings.noticeTo}
          noticeFrom={noticeSettings.noticeFrom}
          noticeCc={noticeSettings.noticeCc}
          noticeSubject={noticeSettings.noticeSubject}
          noticeContext={noticeSettings.noticeContext}
          meetingRoom={noticeSettings.meetingRoom}
          audience={audience}
          checkInMode={checkInMode}
          allowPersonalLinkToken={checkInMode === InternalStaffCheckInMode.PERSONAL_LINK}
          eventType={eventType}
          zoomJoinUrl={zoomJoinUrl}
          locationLabel={locationLabel}
          eventDescription={eventDescription}
          orgInternalStaffFooterContact={orgInternalStaffFooterContact}
          memoDate={new Date()}
        />
      </Modal>
    </div>
  );
}
