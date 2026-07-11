"use client";

import { InternalStaffEmailTemplateKind, InternalStaffNoticeKind, InternalStaffSmsTemplateKind, EventType } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";

import { StaffNoticeMailyEditor } from "@/components/internal-staff/StaffNoticeMailyEditor";
import { Input } from "@/components/ui/Input";
import { blankStaffNoticeMailyDocument } from "@/lib/email/staffNoticeMergeTags";

const NOTICE_KIND_OPTIONS: Array<{ value: InternalStaffNoticeKind; label: string }> = [
  { value: InternalStaffNoticeKind.TRAINING, label: "Training" },
  { value: InternalStaffNoticeKind.SENSITIZATION, label: "Sensitisation" },
  { value: InternalStaffNoticeKind.MEETING, label: "Staff meeting" },
  { value: InternalStaffNoticeKind.BRIEFING, label: "Briefing" }
];

const EMAIL_TEMPLATE_OPTIONS: Array<{ value: InternalStaffEmailTemplateKind; label: string }> = [
  { value: InternalStaffEmailTemplateKind.MEMORANDUM, label: "Memorandum" },
  { value: InternalStaffEmailTemplateKind.NOTICE, label: "Notice" },
  { value: InternalStaffEmailTemplateKind.BLANK, label: "Blank draft" }
];

const SMS_TEMPLATE_OPTIONS: Array<{ value: InternalStaffSmsTemplateKind; label: string }> = [
  { value: InternalStaffSmsTemplateKind.STANDARD, label: "Standard (date/time + link)" },
  { value: InternalStaffSmsTemplateKind.SHORT, label: "Short (short reminder)" },
  { value: InternalStaffSmsTemplateKind.BLANK, label: "Blank SMS (custom text)" }
];

export type InternalStaffNoticeSettings = {
  noticeKind: InternalStaffNoticeKind;
  emailTemplateKind: InternalStaffEmailTemplateKind;
  smsTemplateKind: InternalStaffSmsTemplateKind;
  smsCustomText: string;
  /** Maily document for blank email template. */
  emailCustomMailyJson: JSONContent;
  noticeTo: string;
  noticeFrom: string;
  noticeCc: string;
  /** Optional override for the memo / email subject line. */
  noticeSubject: string;
  noticeContext: string;
  /** Meeting room / room name included in the venue line for in-person and hybrid programmes. */
  meetingRoom: string;
};

type InternalStaffNoticeFormProps = {
  value: InternalStaffNoticeSettings;
  onChange: (next: InternalStaffNoticeSettings) => void;
  eventType?: EventType;
};

const field =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15";

export function InternalStaffNoticeForm({ value, onChange, eventType }: InternalStaffNoticeFormProps) {
  const isBlankEmail = value.emailTemplateKind === InternalStaffEmailTemplateKind.BLANK;

  return (
    <div className="space-y-5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-900">Templates & memo content</p>
        <p className="text-sm text-zinc-600">
          Pick the email layout + SMS copy style, then fill the memo TO / FROM / CC / rationale wording.
          {isBlankEmail ? " Blank email uses only your custom Maily draft — no default memo boilerplate." : ""}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white/60 p-4">
        <p className="text-sm font-semibold text-zinc-900">Email & SMS templates</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Email layout</label>
            <select
              className={field}
              value={value.emailTemplateKind}
              onChange={(e) =>
                onChange({ ...value, emailTemplateKind: e.target.value as InternalStaffEmailTemplateKind })
              }
            >
              {EMAIL_TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">SMS copy</label>
            <select
              className={field}
              value={value.smsTemplateKind}
              onChange={(e) =>
                onChange({ ...value, smsTemplateKind: e.target.value as InternalStaffSmsTemplateKind })
              }
            >
              {SMS_TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {value.smsTemplateKind === InternalStaffSmsTemplateKind.BLANK ? (
          <div>
            <label className="text-xs font-medium text-zinc-700">Blank SMS text</label>
            <textarea
              className={`${field} min-h-[100px]`}
              placeholder="Type the SMS body exactly how you want it to be sent… Use {link} for the shortened check-in URL."
              value={value.smsCustomText}
              onChange={(e) => onChange({ ...value, smsCustomText: e.target.value })}
            />
          </div>
        ) : null}

        {isBlankEmail ? (
          <div>
            <label className="text-xs font-medium text-zinc-700">Blank email body</label>
            <p className="mt-1 text-xs text-zinc-500">
              Draft the full email from scratch. Use merge tags for staff name, check-in link, dates, and memo lines.
            </p>
            <div className="mt-2">
              <StaffNoticeMailyEditor
                value={value.emailCustomMailyJson ?? blankStaffNoticeMailyDocument()}
                onChange={(emailCustomMailyJson) => onChange({ ...value, emailCustomMailyJson })}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white/60 p-4">
        <p className="text-sm font-semibold text-zinc-900">
          {isBlankEmail ? "Email subject & programme details" : "Programme type & memo lines"}
        </p>
        <div>
          <label className="text-xs font-medium text-zinc-700">Programme type</label>
          <select
            className={field}
            value={value.noticeKind}
            onChange={(e) =>
              onChange({ ...value, noticeKind: e.target.value as InternalStaffNoticeKind })
            }
          >
            {NOTICE_KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700">Memo subject (optional override)</label>
          <Input
            className="mt-1"
            placeholder="Leave blank to auto-generate from programme type and event name"
            value={value.noticeSubject}
            onChange={(e) => onChange({ ...value, noticeSubject: e.target.value })}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Shown as the memo SUBJECT line and used as the email subject when sending notices.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700">Meeting room</label>
          <Input
            className="mt-1"
            placeholder="e.g. Committee Room 2 / Auditorium A"
            value={value.meetingRoom}
            onChange={(e) => onChange({ ...value, meetingRoom: e.target.value })}
          />
          <p className="mt-1 text-xs text-zinc-500">
            {eventType === EventType.VIRTUAL
              ? "Not used for virtual-only programmes (venue shows as Virtual)."
              : "Shown in staff emails as: Venue: {meeting room}, {venue name} — {address}."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Memo TO</label>
            <Input
              className="mt-1"
              placeholder="e.g. ALL STAFF (leave blank to auto-fill from audience)"
              value={value.noticeTo}
              onChange={(e) => onChange({ ...value, noticeTo: e.target.value })}
            />
            {isBlankEmail ? (
              <p className="mt-1 text-xs text-zinc-500">Available as @memo_to merge tag in your draft.</p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">Memo FROM</label>
            <Input
              className="mt-1"
              placeholder="e.g. HEAD, HUMAN RESOURCES & ADMINISTRATION"
              value={value.noticeFrom}
              onChange={(e) => onChange({ ...value, noticeFrom: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-700">Memo CC (optional)</label>
            <Input
              className="mt-1"
              placeholder="e.g. CHIEF EXECUTIVE OFFICER"
              value={value.noticeCc}
              onChange={(e) => onChange({ ...value, noticeCc: e.target.value })}
            />
          </div>
        </div>

        {!isBlankEmail ? (
          <div>
            <label className="text-xs font-medium text-zinc-700">Context / rationale paragraph</label>
            <textarea
              className={`${field} min-h-[120px]`}
              placeholder="Legal background, purpose of the session, implementation notes…"
              value={value.noticeContext}
              onChange={(e) => onChange({ ...value, noticeContext: e.target.value })}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Used as the memo’s opening paragraph. Session date &amp; time are inserted automatically.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
